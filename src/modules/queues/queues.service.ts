import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import {
  TicketStatus, QueueStatus, VALID_TICKET_TRANSITIONS,
  generateTicketNumber, generateCustomerId, deriveCustomerIdFromPhone,
  SOCKET_EVENTS,
} from 'selfless-sdk';

@Injectable()
export class QueuesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private realtime: RealtimeGateway,
  ) {}

  async findAll(branchId?: string, date?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (date) {
      const d = new Date(date);
      where.date = { gte: new Date(d.setHours(0, 0, 0, 0)), lt: new Date(d.setHours(24, 0, 0, 0)) };
    }
    return this.prisma.queue.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, prefix: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const queue = await this.prisma.queue.findUnique({
      where: { id },
      include: {
        service: true,
        branch: { select: { id: true, name: true, timezone: true } },
        _count: { select: { tickets: true } },
      },
    });
    if (!queue) throw new NotFoundException('Queue not found');
    return queue;
  }

  async openQueue(dto: { branchId: string; serviceId: string }) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = await this.prisma.queue.findFirst({
      where: { branchId: dto.branchId, serviceId: dto.serviceId, date: { gte: today } },
    });
    if (existing && existing.status === QueueStatus.OPEN) {
      throw new ConflictException('Queue already open for this service today');
    }

    const queue = await this.prisma.queue.create({
      data: {
        branchId: dto.branchId,
        serviceId: dto.serviceId,
        prefix: service.prefix,
        status: QueueStatus.OPEN,
      },
      include: { service: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });

    this.realtime.emitToBranch(dto.branchId, SOCKET_EVENTS.QUEUE_OPENED, queue);
    return queue;
  }

  async updateQueueStatus(id: string, status: QueueStatus) {
    const queue = await this.findOne(id);
    if (queue.status === status) return queue;

    const data: any = { status };
    if (status === QueueStatus.CLOSED) {
      data.closedAt = new Date();
      await this.prisma.queueTicket.updateMany({
        where: { queueId: id, status: { in: [TicketStatus.WAITING, TicketStatus.PENDING] } },
        data: { status: TicketStatus.EXPIRED },
      });
    }

    const updated = await this.prisma.queue.update({ where: { id }, data, include: { service: true } });
    this.realtime.emitToBranch(queue.branchId, SOCKET_EVENTS.QUEUE_CLOSED, updated);
    return updated;
  }

  async issueTicket(queueId: string, dto: { phone?: string; name?: string; notes?: string; priority?: number }) {
    const queue = await this.findOne(queueId);
    if (queue.status !== QueueStatus.OPEN) throw new BadRequestException('Queue is not open');

    const branch = await this.prisma.branch.findUnique({ where: { id: queue.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const waitingCount = await this.prisma.queueTicket.count({
      where: { queueId, status: { in: [TicketStatus.WAITING, TicketStatus.CALLED, TicketStatus.SERVING] } },
    });
    if (waitingCount >= branch.maxQueueCapacity) throw new BadRequestException('Queue is at capacity');

    let customerId: string | undefined;
    if (dto.phone) {
      const derivedId = deriveCustomerIdFromPhone(dto.phone);
      const customer = await this.prisma.customer.upsert({
        where: { customerId: derivedId },
        create: { customerId: derivedId, phone: dto.phone, name: dto.name },
        update: { lastSeenAt: new Date(), ...(dto.name ? { name: dto.name } : {}) },
      });
      customerId = customer.id;
    }

    const nextNumber = (queue as any).currentNumber + 1;
    const ticketNumber = generateTicketNumber(queue.prefix, nextNumber);

    const [ticket] = await this.prisma.$transaction(async (tx: any) => {
      await tx.queue.update({ where: { id: queueId }, data: { currentNumber: nextNumber } });
      const t = await tx.queueTicket.create({
        data: {
          queueId,
          serviceId: queue.serviceId,
          branchId: queue.branchId,
          ticketNumber,
          status: TicketStatus.WAITING,
          customerId,
          notes: dto.notes,
          priority: dto.priority || 0,
          issuedAt: new Date(),
        },
        include: { customer: true },
      });
      return [t];
    });

    const stats = await this.getQueueStats(queueId);
    this.realtime.emitToBranch(queue.branchId, SOCKET_EVENTS.TICKET_CREATED, ticket);
    this.realtime.emitToQueue(queueId, SOCKET_EVENTS.QUEUE_STATS_UPDATED, stats);

    return ticket;
  }

  async callNext(queueId: string, operatorId: string, counterNumber?: string) {
    const queue = await this.findOne(queueId);
    if (queue.status !== QueueStatus.OPEN) throw new BadRequestException('Queue is not open');

    const next = await this.prisma.queueTicket.findFirst({
      where: { queueId, status: TicketStatus.WAITING },
      orderBy: [{ priority: 'desc' }, { issuedAt: 'asc' }],
    });
    if (!next) throw new NotFoundException('No waiting tickets');

    return this.transitionTicket(next.id, TicketStatus.CALLED, operatorId, { counterNumber });
  }

  async transitionTicket(
    ticketId: string,
    newStatus: TicketStatus,
    operatorId?: string,
    extra?: { counterNumber?: string; notes?: string },
  ) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id: ticketId },
      include: { queue: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const validNext = VALID_TICKET_TRANSITIONS[ticket.status as TicketStatus] || [];
    if (!validNext.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${ticket.status} to ${newStatus}`);
    }

    const now = new Date();
    const data: any = { status: newStatus, updatedAt: now };
    if (operatorId) data.operatorId = operatorId;
    if (extra?.counterNumber) data.counterNumber = extra.counterNumber;
    if (extra?.notes) data.notes = extra.notes;

    if (newStatus === TicketStatus.CALLED) data.calledAt = now;
    if (newStatus === TicketStatus.SERVING) {
      data.servedAt = now;
      if (ticket.calledAt) data.waitSeconds = Math.floor((now.getTime() - ticket.issuedAt.getTime()) / 1000);
    }
    if (newStatus === TicketStatus.COMPLETED) {
      data.completedAt = now;
      if (ticket.servedAt) data.serviceSeconds = Math.floor((now.getTime() - (ticket as any).servedAt.getTime()) / 1000);
    }

    const updated = await this.prisma.queueTicket.update({ where: { id: ticketId }, data, include: { customer: true } });

    const stats = await this.getQueueStats(ticket.queueId);
    this.realtime.emitToBranch(ticket.queue.branchId, SOCKET_EVENTS.TICKET_STATUS_CHANGED, { ticket: updated, newStatus });
    this.realtime.emitToQueue(ticket.queueId, SOCKET_EVENTS.QUEUE_STATS_UPDATED, stats);

    return updated;
  }

  async getQueueTickets(queueId: string, status?: TicketStatus) {
    return this.prisma.queueTicket.findMany({
      where: { queueId, ...(status ? { status } : {}) },
      include: { customer: true, operator: { select: { id: true, name: true } } },
      orderBy: [{ priority: 'desc' }, { issuedAt: 'asc' }],
    });
  }

  async getQueueStats(queueId: string) {
    const counts = await this.prisma.queueTicket.groupBy({
      by: ['status'],
      where: { queueId },
      _count: { status: true },
    });

    const result: Record<string, number> = {};
    for (const c of counts) result[c.status] = c._count.status;

    const served = await this.prisma.queueTicket.findMany({
      where: { queueId, status: TicketStatus.COMPLETED, waitSeconds: { not: null } },
      select: { waitSeconds: true },
    });
    const avgWait = served.length > 0
      ? Math.round(served.reduce((s, t) => s + (t.waitSeconds || 0), 0) / served.length)
      : 0;

    return { queueId, counts: result, avgWaitSeconds: avgWait, totalServed: result[TicketStatus.COMPLETED] || 0 };
  }
}
