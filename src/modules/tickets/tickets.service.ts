import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { WorkflowsService } from '../workflows/workflows.service.js';
import { TicketStatus, TicketEventType, VALID_TICKET_TRANSITIONS, SOCKET_EVENTS, generateTicketNumber } from 'selfless-sdk';
import { IssueTicketDto, TransferTicketDto } from './dto/ticket.dto.js';
import { getBranchDayStart } from '../../common/utils/branch-time.util.js';

export interface TicketViewer {
  accountId: string;
  activeOrgId?: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private realtime: RealtimeGateway,
    private workflows: WorkflowsService,
  ) {}

  // ── Issue a ticket ─────────────────────────────────────────────────────

  async issue(organizationId: string, dto: IssueTicketDto, issuedByCustomerId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId }, include: { workflow: { include: { steps: { where: { isInitial: true } } } }, branch: true } });
    if (!service || !service.isActive) throw new NotFoundException('Service not found or inactive');
    if (service.branch.organizationId !== organizationId || service.branchId !== dto.branchId) {
      throw new ForbiddenException('That branch/service does not belong to this organization.');
    }

    const branch = service.branch;
    if (branch.status !== 'ACTIVE') throw new BadRequestException('Branch not active');

    // Capacity check
    const active = await this.prisma.ticket.count({
      where: { branchId: dto.branchId, status: { in: [TicketStatus.CREATED, TicketStatus.WAITING, TicketStatus.CALLED, TicketStatus.IN_SERVICE, TicketStatus.ON_HOLD] } },
    });
    if (active >= branch.maxCapacity) throw new BadRequestException('Branch queue is at capacity');

    // Resolve customer: self-issue always wins, then explicit customerId, then phone lookup/creation
    let customerId = issuedByCustomerId ?? dto.customerId;
    if (!customerId && dto.phone) {
      const cust = await this.prisma.account.upsert({
        where: { phone: dto.phone },
        create: { phone: dto.phone, firstName: 'Walk-in' },
        update: { updatedAt: new Date() },
      });
      customerId = cust.id;
    }

    // Determine initial workflow step
    const initialStep = service.workflow?.steps?.[0] ?? null;

    // Generate ticket number from today's branch-service count + 1 (today = branch-local day)
    const todayStart = getBranchDayStart(branch.timezone);

    // Priority: sum of the customer's persistent flags + any one-off flags chosen at issuance (never a raw client-supplied number)
    const priority = await this.computePriority(organizationId, customerId, dto.priorityFlagIds);

    // Count + generate + create happen inside one transaction, serialized by a Postgres advisory
    // lock scoped to this branch+service+day, so two concurrent issuances can never compute the
    // same "next" number — the lock is released automatically when the transaction commits, by
    // which point the counted ticket already exists for the next caller to see.
    const ticket = await this.prisma.$transaction(async (tx) => {
      const lockKey = `ticket-seq:${dto.branchId}:${dto.serviceId}:${todayStart.toISOString().slice(0, 10)}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const todayCount = await tx.ticket.count({ where: { branchId: dto.branchId, serviceId: dto.serviceId, issuedAt: { gte: todayStart } } });
      const queueNumber = generateTicketNumber(service.prefix, todayCount + 1);

      return tx.ticket.create({
        data: {
          organizationId,
          branchId: dto.branchId,
          serviceId: dto.serviceId,
          customerId: customerId ?? null,
          queueNumber,
          prefix: service.prefix,
          workflowId: service.workflowId ?? null,
          currentStepId: initialStep?.id ?? null,
          status: TicketStatus.WAITING,
          priority,
          notes: dto.notes ?? null,
          formData: (dto.formData ?? undefined) as any,
          issuedAt: new Date(),
        },
        include: { service: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } }, customer: true, currentStep: true },
      });
    });
    const queueNumber = ticket.queueNumber;

    if (dto.priorityFlagIds?.length) {
      await this.prisma.ticketPriorityFlag.createMany({
        data: dto.priorityFlagIds.map((flagId) => ({ ticketId: ticket.id, flagId })),
        skipDuplicates: true,
      });
    }

    await this.logEvent(ticket.id, TicketEventType.CREATED, null, null, TicketStatus.WAITING, null);

    if (ticket.customer?.telegramId) {
      this.notifications.sendTelegram(ticket.customer.telegramId, `🎫 Your ticket is *${queueNumber}* at ${branch.name} for ${service.name}. Please wait for your turn.`).catch(() => {});
    }

    this.realtime.emitToBranch(dto.branchId, SOCKET_EVENTS.TICKET_CREATED, { ticket });
    return ticket;
  }

  private async computePriority(organizationId: string, customerId: string | undefined, ticketFlagIds?: string[]): Promise<number> {
    let total = 0;
    if (customerId) {
      const accountFlags = await this.prisma.accountPriorityFlag.findMany({
        where: { accountId: customerId, flag: { organizationId, isActive: true }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        include: { flag: true },
      });
      total += accountFlags.reduce((sum, f) => sum + f.flag.weight, 0);
    }
    if (ticketFlagIds?.length) {
      const flags = await this.prisma.priorityFlag.findMany({ where: { id: { in: ticketFlagIds }, organizationId, isActive: true } });
      total += flags.reduce((sum, f) => sum + f.weight, 0);
    }
    return total;
  }

  // ── Call next ticket ───────────────────────────────────────────────────

  async callNext(queueId: string, operatorId: string, counterId?: string) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId }, include: { branch: true } });
    if (!queue || queue.status !== 'OPEN') throw new BadRequestException('Queue is not open');

    // Only consider tickets issued today (branch-local day) — stale tickets from previous
    // days must never be called (they belong to the expiry worker)
    const startOfToday = getBranchDayStart(queue.branch.timezone);

    // transition() atomically claims a ticket only if it's still WAITING at write time. If two
    // officers call-next at the same instant, the loser's claim fails and retries against the
    // next candidate instead of silently double-serving the same ticket.
    const excludeIds: string[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const next = await this.prisma.ticket.findFirst({
        where: {
          branchId: queue.branchId,
          serviceId: queue.serviceId,
          ...(queue.stepId ? { currentStepId: queue.stepId } : {}),
          status: TicketStatus.WAITING,
          issuedAt: { gte: startOfToday },
          id: excludeIds.length ? { notIn: excludeIds } : undefined,
        },
        orderBy: [{ priority: 'desc' }, { issuedAt: 'asc' }],
      });
      if (!next) throw new NotFoundException('No waiting tickets');

      try {
        return await this.transition(next.id, TicketStatus.CALLED, operatorId, { counterId });
      } catch (err) {
        if (err instanceof ConflictException) {
          excludeIds.push(next.id);
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException('Could not claim a ticket right now — please retry.');
  }

  // ── Transition ticket status ───────────────────────────────────────────

  async transition(
    ticketId: string,
    newStatus: TicketStatus,
    actorId?: string,
    opts?: { counterId?: string; notes?: string; toStepId?: string; formData?: Record<string, unknown> },
    scopeOrgId?: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, include: { customer: true, currentStep: true } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (scopeOrgId && ticket.organizationId !== scopeOrgId) throw new NotFoundException('Ticket not found');

    const validNext = VALID_TICKET_TRANSITIONS[ticket.status as TicketStatus] ?? [];
    if (!validNext.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition ${ticket.status} → ${newStatus}`);
    }

    const now = new Date();
    const data: any = { status: newStatus };
    if (actorId) data.operatorId = actorId;
    if (opts?.counterId) data.currentCounterId = opts.counterId;
    if (opts?.notes) data.notes = opts.notes;
    if (opts?.formData) data.formData = opts.formData;
    if (opts?.toStepId) data.currentStepId = opts.toStepId;

    if (newStatus === TicketStatus.CALLED) data.calledAt = now;
    if (newStatus === TicketStatus.IN_SERVICE) {
      data.servedAt = now;
      if (ticket.issuedAt) data.waitSeconds = Math.floor((now.getTime() - ticket.issuedAt.getTime()) / 1000);
    }
    if (newStatus === TicketStatus.COMPLETED || newStatus === TicketStatus.REJECTED) {
      data.completedAt = now;
      if ((ticket as any).servedAt) data.serviceSeconds = Math.floor((now.getTime() - (ticket as any).servedAt.getTime()) / 1000);
    }

    // Atomic claim: the update only applies if the ticket is still in the status we read it as —
    // if two callers race on the same ticket, only the first one's write actually matches this
    // WHERE clause; the second gets count 0 and must not proceed as if it had succeeded.
    const claim = await this.prisma.ticket.updateMany({ where: { id: ticketId, status: ticket.status }, data });
    if (claim.count === 0) {
      throw new ConflictException('This ticket was already updated by someone else.');
    }

    const updated = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { customer: true, currentStep: true, currentCounter: true, service: { select: { name: true } } },
    });

    const eventMap: Record<TicketStatus, TicketEventType> = {
      [TicketStatus.CALLED]: TicketEventType.CALLED,
      [TicketStatus.IN_SERVICE]: TicketEventType.SERVING_STARTED,
      [TicketStatus.ON_HOLD]: TicketEventType.ON_HOLD,
      [TicketStatus.TRANSFERRED]: TicketEventType.TRANSFERRED,
      [TicketStatus.AWAITING_PAYMENT]: TicketEventType.AWAITING_PAYMENT,
      [TicketStatus.AWAITING_DOCUMENT]: TicketEventType.AWAITING_DOCUMENT,
      [TicketStatus.COMPLETED]: TicketEventType.COMPLETED,
      [TicketStatus.REJECTED]: TicketEventType.REJECTED,
      [TicketStatus.CANCELLED]: TicketEventType.CANCELLED,
      [TicketStatus.NO_SHOW]: TicketEventType.NO_SHOW,
      [TicketStatus.EXPIRED]: TicketEventType.EXPIRED,
      [TicketStatus.WAITING]: TicketEventType.CREATED,
      [TicketStatus.CREATED]: TicketEventType.CREATED,
      [TicketStatus.ABANDONED]: TicketEventType.EXPIRED,
    };
    await this.logEvent(ticketId, eventMap[newStatus] ?? TicketEventType.NOTE_ADDED, actorId ?? null, ticket.status as TicketStatus, newStatus, opts?.counterId ?? null, { notes: opts?.notes });

    // Notify customer when called
    if (newStatus === TicketStatus.CALLED && updated.customer?.telegramId) {
      const counterName = updated.currentCounter?.name ?? 'your counter';
      this.notifications.sendTelegram(updated.customer.telegramId, `📢 *Ticket ${updated.queueNumber}* — please proceed to *${counterName}* now!`).catch(() => {});
    }

    this.realtime.emitToBranch(updated.branchId, SOCKET_EVENTS.TICKET_STATUS_CHANGED, {
      ticketId, queueNumber: updated.queueNumber, previousStatus: ticket.status, status: newStatus, branchId: updated.branchId,
    });
    return updated;
  }

  // ── Transfer ticket ────────────────────────────────────────────────────

  async transfer(ticketId: string, actorId: string, dto: TransferTicketDto, scopeOrgId?: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (scopeOrgId && ticket.organizationId !== scopeOrgId) throw new NotFoundException('Ticket not found');

    const transferable = [TicketStatus.IN_SERVICE, TicketStatus.ON_HOLD, TicketStatus.WAITING, TicketStatus.CALLED];
    if (!transferable.includes(ticket.status as TicketStatus)) {
      throw new BadRequestException(`Ticket in status ${ticket.status} cannot be transferred`);
    }

    const data: any = { status: TicketStatus.WAITING, currentCounterId: null };
    const meta: any = { notes: dto.notes };

    if (dto.toServiceId) {
      const svc = await this.prisma.service.findUnique({ where: { id: dto.toServiceId }, include: { workflow: { include: { steps: { where: { isInitial: true } } } }, branch: true } });
      if (!svc) throw new NotFoundException('Target service not found');
      if (scopeOrgId && svc.branch.organizationId !== scopeOrgId) throw new ForbiddenException('Target service is outside your organization.');
      data.serviceId = dto.toServiceId;
      data.workflowId = svc.workflowId ?? null;
      data.currentStepId = svc.workflow?.steps?.[0]?.id ?? null;
      meta.toServiceId = dto.toServiceId;
      meta.toServiceName = svc.name;
    } else if (dto.toStepId) {
      const step = await this.prisma.workflowStep.findUnique({ where: { id: dto.toStepId }, include: { workflow: true } });
      if (!step) throw new NotFoundException('Target step not found');
      if (scopeOrgId && step.workflow.organizationId !== scopeOrgId) throw new ForbiddenException('Target step is outside your organization.');
      data.currentStepId = dto.toStepId;
      meta.toStepId = dto.toStepId;
      meta.toStepName = step.name;
    } else {
      throw new BadRequestException('Provide toServiceId or toStepId');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data,
      include: { customer: true, currentStep: true, currentCounter: true, service: { select: { name: true } } },
    });

    await this.logEvent(ticketId, TicketEventType.TRANSFERRED, actorId, ticket.status as TicketStatus, TicketStatus.WAITING, null, meta);

    this.realtime.emitToBranch(updated.branchId, SOCKET_EVENTS.TICKET_STATUS_CHANGED, {
      ticketId, queueNumber: updated.queueNumber, previousStatus: ticket.status, status: TicketStatus.WAITING, branchId: updated.branchId,
    });
    return updated;
  }

  // ── Advance workflow step ──────────────────────────────────────────────

  async advanceStep(ticketId: string, transitionId: string, actorId: string, scopeOrgId?: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (scopeOrgId && ticket.organizationId !== scopeOrgId) throw new NotFoundException('Ticket not found');
    if (ticket.status !== TicketStatus.IN_SERVICE && ticket.status !== TicketStatus.AWAITING_PAYMENT && ticket.status !== TicketStatus.AWAITING_DOCUMENT) {
      throw new BadRequestException('Ticket must be IN_SERVICE to advance');
    }

    const transition = await this.prisma.workflowTransition.findUnique({ where: { id: transitionId }, include: { destinationStep: true } });
    if (!transition || transition.sourceStepId !== ticket.currentStepId) throw new BadRequestException('Invalid transition');

    // Condition must actually pass against the ticket's formData — not just "the ID was well-formed"
    const available = await this.workflows.getAvailableTransitions(ticket.currentStepId!, ticket.formData as any);
    if (!available.some((t) => t.id === transitionId)) {
      throw new BadRequestException('This transition is not available for the ticket in its current state.');
    }

    const isFinal = transition.destinationStep.isFinal;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        currentStepId: transition.destinationStepId,
        status: isFinal ? TicketStatus.COMPLETED : TicketStatus.WAITING,
        currentCounterId: null,
        ...(isFinal ? { completedAt: new Date() } : {}),
      },
      include: { currentStep: true },
    });

    await this.logEvent(ticketId, isFinal ? TicketEventType.COMPLETED : TicketEventType.STEP_ADVANCED, actorId, ticket.status as TicketStatus, updated.status as TicketStatus, null, { transitionId, toStep: transition.destinationStep.name });

    this.realtime.emitToBranch(ticket.branchId, SOCKET_EVENTS.TICKET_STEP_ADVANCED, { ticketId, toStep: transition.destinationStep });
    return updated;
  }

  // ── Query ──────────────────────────────────────────────────────────────

  async findAll(filter: { branchId?: string; serviceId?: string; status?: string; stepId?: string; date?: string }, scopeOrgId?: string) {
    const where: any = {};
    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.serviceId) where.serviceId = filter.serviceId;
    if (filter.status) where.status = filter.status;
    if (filter.stepId) where.currentStepId = filter.stepId;
    if (scopeOrgId) where.organizationId = scopeOrgId;
    if (filter.date) {
      const d = new Date(filter.date); d.setHours(0, 0, 0, 0);
      const d2 = new Date(filter.date); d2.setHours(23, 59, 59, 999);
      where.issuedAt = { gte: d, lte: d2 };
    }
    return this.prisma.ticket.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        currentStep: { select: { id: true, name: true } },
        currentCounter: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        operator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ priority: 'desc' }, { issuedAt: 'asc' }],
      take: 500,
    });
  }

  async findOne(id: string, viewer: TicketViewer) {
    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: true,
        service: true,
        branch: { select: { id: true, name: true } },
        currentStep: true,
        currentCounter: true,
        operator: { select: { id: true, firstName: true, lastName: true } },
        events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    if (!t) throw new NotFoundException('Ticket not found');
    this.assertCanView(t, viewer);
    return t;
  }

  async getAvailableTransitions(ticketId: string, viewer: TicketViewer) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertCanView(ticket, viewer);
    if (!ticket.currentStepId) return [];
    return this.workflows.getAvailableTransitions(ticket.currentStepId, ticket.formData as any);
  }

  private assertCanView(ticket: { organizationId: string; customerId: string | null }, viewer: TicketViewer) {
    if (viewer.isSuperAdmin) return;
    const ownsAsStaff = !!viewer.activeOrgId && ticket.organizationId === viewer.activeOrgId;
    const ownsAsCustomer = ticket.customerId === viewer.accountId;
    if (!ownsAsStaff && !ownsAsCustomer) throw new NotFoundException('Ticket not found');
  }

  // ── Private ────────────────────────────────────────────────────────────

  private async logEvent(
    ticketId: string, eventType: TicketEventType, actorId: string | null,
    fromStatus: TicketStatus | null, toStatus: TicketStatus | null,
    counterId: string | null, metadata?: any,
  ) {
    return this.prisma.ticketEvent.create({ data: { ticketId, eventType, actorId, fromStatus, toStatus, counterId, metadata } });
  }
}
