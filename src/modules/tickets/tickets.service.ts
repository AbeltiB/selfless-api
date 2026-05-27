import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { WorkflowsService } from '../workflows/workflows.service.js';
import { TicketStatus, TicketEventType, VALID_TICKET_TRANSITIONS, SOCKET_EVENTS, generateTicketNumber } from 'selfless-sdk';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private realtime: RealtimeGateway,
    private workflows: WorkflowsService,
  ) {}

  // ── Issue a ticket ─────────────────────────────────────────────────────

  async issue(dto: {
    organizationId: string;
    branchId: string;
    serviceId: string;
    customerId?: string;
    phone?: string;
    notes?: string;
    priority?: number;
    formData?: Record<string, unknown>;
  }) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId }, include: { workflow: { include: { steps: { where: { isInitial: true } } } } } });
    if (!service || !service.isActive) throw new NotFoundException('Service not found or inactive');

    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch || branch.status !== 'ACTIVE') throw new BadRequestException('Branch not active');

    // Capacity check
    const active = await this.prisma.ticket.count({
      where: { branchId: dto.branchId, status: { in: [TicketStatus.CREATED, TicketStatus.WAITING, TicketStatus.CALLED, TicketStatus.IN_SERVICE, TicketStatus.ON_HOLD] } },
    });
    if (active >= branch.maxCapacity) throw new BadRequestException('Branch queue is at capacity');

    // Resolve customer from phone if no customerId provided
    let customerId = dto.customerId;
    if (!customerId && dto.phone) {
      const cust = await this.prisma.customer.upsert({
        where: { phone: dto.phone },
        create: { phone: dto.phone, firstName: 'Walk-in', profileComplete: false },
        update: { updatedAt: new Date() },
      });
      customerId = cust.id;
    }

    // Determine initial workflow step
    const initialStep = service.workflow?.steps?.[0] ?? null;

    // Generate ticket number from today's branch-service count + 1
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayCount = await this.prisma.ticket.count({ where: { branchId: dto.branchId, serviceId: dto.serviceId, issuedAt: { gte: todayStart } } });
    const queueNumber = generateTicketNumber(service.prefix, todayCount + 1);

    const ticket = await this.prisma.ticket.create({
      data: {
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        serviceId: dto.serviceId,
        customerId: customerId ?? null,
        queueNumber,
        prefix: service.prefix,
        workflowId: service.workflowId ?? null,
        currentStepId: initialStep?.id ?? null,
        status: TicketStatus.WAITING,
        priority: dto.priority ?? 0,
        notes: dto.notes ?? null,
        formData: (dto.formData ?? undefined) as any,
        issuedAt: new Date(),
      },
      include: { service: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } }, customer: true, currentStep: true },
    });

    await this.logEvent(ticket.id, TicketEventType.CREATED, null, null, TicketStatus.WAITING, null);

    // Notify customer via Telegram if available
    if (ticket.customer?.telegramId) {
      this.notifications.sendTelegram(ticket.customer.telegramId, `🎫 Your ticket is *${queueNumber}* at ${branch.name} for ${service.name}. Please wait for your turn.`).catch(() => {});
    }

    this.realtime.emitToBranch(dto.branchId, SOCKET_EVENTS.TICKET_CREATED, { ticket });
    return ticket;
  }

  // ── Call next ticket ───────────────────────────────────────────────────

  async callNext(queueId: string, operatorId: string, counterId?: string) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId }, include: { branch: true } });
    if (!queue || queue.status !== 'OPEN') throw new BadRequestException('Queue is not open');

    const next = await this.prisma.ticket.findFirst({
      where: {
        branchId: queue.branchId,
        serviceId: queue.serviceId,
        ...(queue.stepId ? { currentStepId: queue.stepId } : {}),
        status: TicketStatus.WAITING,
      },
      orderBy: [{ priority: 'desc' }, { issuedAt: 'asc' }],
      include: { customer: true },
    });
    if (!next) throw new NotFoundException('No waiting tickets');

    return this.transition(next.id, TicketStatus.CALLED, operatorId, { counterId });
  }

  // ── Transition ticket status ───────────────────────────────────────────

  async transition(
    ticketId: string,
    newStatus: TicketStatus,
    actorId?: string,
    opts?: { counterId?: string; notes?: string; toStepId?: string; formData?: Record<string, unknown> },
  ) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, include: { customer: true, currentStep: true } });
    if (!ticket) throw new NotFoundException('Ticket not found');

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

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data,
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

  // ── Advance workflow step ──────────────────────────────────────────────

  async advanceStep(ticketId: string, transitionId: string, actorId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status !== TicketStatus.IN_SERVICE && ticket.status !== TicketStatus.AWAITING_PAYMENT && ticket.status !== TicketStatus.AWAITING_DOCUMENT) {
      throw new BadRequestException('Ticket must be IN_SERVICE to advance');
    }

    const transition = await this.prisma.workflowTransition.findUnique({ where: { id: transitionId }, include: { destinationStep: true } });
    if (!transition || transition.sourceStepId !== ticket.currentStepId) throw new BadRequestException('Invalid transition');

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

  async findAll(filter: { branchId?: string; serviceId?: string; status?: string; stepId?: string; date?: string }) {
    const where: any = {};
    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.serviceId) where.serviceId = filter.serviceId;
    if (filter.status) where.status = filter.status;
    if (filter.stepId) where.currentStepId = filter.stepId;
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
        operator: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { issuedAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: true,
        service: true,
        branch: { select: { id: true, name: true } },
        currentStep: true,
        currentCounter: true,
        operator: { select: { id: true, name: true } },
        events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, name: true } } } },
      },
    });
    if (!t) throw new NotFoundException('Ticket not found');
    return t;
  }

  async getAvailableTransitions(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || !ticket.currentStepId) return [];
    return this.workflows.getAvailableTransitions(ticket.currentStepId, ticket.formData as any);
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
