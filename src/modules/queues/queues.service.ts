import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { QueueStatus, TicketStatus, SOCKET_EVENTS } from 'selfless-sdk';
import { OpenQueueDto } from './dto/queue.dto.js';
import { getBranchDayStart } from '../../common/utils/branch-time.util.js';

@Injectable()
export class QueuesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private realtime: RealtimeGateway,
    private tickets: TicketsService,
  ) {}

  async findAll(filter: { branchId?: string; serviceId?: string; stepId?: string; date?: string }, scopeOrgId?: string) {
    const where: any = {};
    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.serviceId) where.serviceId = filter.serviceId;
    if (filter.stepId) where.stepId = filter.stepId;
    if (scopeOrgId) where.branch = { organizationId: scopeOrgId };
    if (filter.date) {
      const d = new Date(filter.date); d.setHours(0, 0, 0, 0);
      const d2 = new Date(filter.date); d2.setHours(23, 59, 59, 999);
      where.date = { gte: d, lte: d2 };
    }
    return this.prisma.queue.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, prefix: true } },
        branch: { select: { id: true, name: true } },
        step: { select: { id: true, name: true, order: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const q = await this.prisma.queue.findUnique({
      where: { id },
      include: {
        service: true,
        branch: { select: { id: true, name: true, timezone: true } },
        step: true,
      },
    });
    if (!q) throw new NotFoundException('Queue not found');
    return q;
  }

  async open(dto: OpenQueueDto, scopeOrgId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId }, include: { branch: true } });
    if (!service) throw new NotFoundException('Service not found');
    if (scopeOrgId && (service.branch.organizationId !== scopeOrgId || dto.branchId !== service.branchId)) {
      throw new ForbiddenException('That branch/service does not belong to your organization.');
    }

    const todayStart = getBranchDayStart(service.branch.timezone);
    const existing = await this.prisma.queue.findFirst({
      where: { branchId: dto.branchId, serviceId: dto.serviceId, ...(dto.stepId ? { stepId: dto.stepId } : {}), date: { gte: todayStart } },
    });
    if (existing && existing.status === QueueStatus.OPEN) {
      throw new ConflictException('Queue already open for this service/step today');
    }

    const queue = await this.prisma.queue.create({
      data: { branchId: dto.branchId, serviceId: dto.serviceId, stepId: dto.stepId ?? null, prefix: service.prefix, status: QueueStatus.OPEN, date: new Date() },
      include: { service: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });

    this.realtime.emitToBranch(dto.branchId, SOCKET_EVENTS.QUEUE_OPENED, queue);
    return queue;
  }

  async updateStatus(id: string, status: QueueStatus, scopeOrgId?: string) {
    const queue = await this.findOne(id);
    if (scopeOrgId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: queue.branchId } });
      if (!branch || branch.organizationId !== scopeOrgId) throw new NotFoundException('Queue not found');
    }
    if (queue.status === status) return queue;

    const data: any = { status };
    if (status === QueueStatus.CLOSED) {
      data.closedAt = new Date();
      await this.prisma.ticket.updateMany({
        where: { branchId: queue.branchId, serviceId: queue.serviceId, status: { in: [TicketStatus.WAITING, TicketStatus.CREATED] } },
        data: { status: TicketStatus.EXPIRED },
      });
    }

    const updated = await this.prisma.queue.update({ where: { id }, data, include: { service: true } });
    const event = status === QueueStatus.CLOSED ? SOCKET_EVENTS.QUEUE_CLOSED : SOCKET_EVENTS.QUEUE_PAUSED;
    this.realtime.emitToBranch(queue.branchId, event, updated);
    return updated;
  }

  async callNext(queueId: string, operatorId: string, counterId?: string, scopeOrgId?: string) {
    if (scopeOrgId) {
      const queue = await this.findOne(queueId);
      const branch = await this.prisma.branch.findUnique({ where: { id: queue.branchId } });
      if (!branch || branch.organizationId !== scopeOrgId) throw new NotFoundException('Queue not found');
    }
    return this.tickets.callNext(queueId, operatorId, counterId);
  }

  async getStats(queueId: string) {
    const queue = await this.findOne(queueId);
    const todayStart = getBranchDayStart(queue.branch.timezone);
    const tickets = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: { branchId: queue.branchId, serviceId: queue.serviceId, ...(queue.stepId ? { currentStepId: queue.stepId } : {}), issuedAt: { gte: todayStart } },
      _count: { status: true },
    });

    const counts: Record<string, number> = {};
    for (const t of tickets) counts[t.status] = t._count.status;

    const served = await this.prisma.ticket.findMany({
      where: { branchId: queue.branchId, serviceId: queue.serviceId, status: TicketStatus.COMPLETED, waitSeconds: { not: null }, issuedAt: { gte: todayStart } },
      select: { waitSeconds: true },
    });
    const avgWait = served.length ? Math.round(served.reduce((s, t) => s + (t.waitSeconds ?? 0), 0) / served.length) : 0;

    return { queueId, counts, avgWaitSeconds: avgWait, totalServed: counts[TicketStatus.COMPLETED] ?? 0 };
  }
}
