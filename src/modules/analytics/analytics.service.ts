import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TicketStatus } from 'selfless-sdk';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(branchId: string, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const [totalTickets, completedTickets, noShowTickets, cancelledTickets, avgWait] = await Promise.all([
      this.prisma.queueTicket.count({ where: { branchId, createdAt: { gte: from } } }),
      this.prisma.queueTicket.count({ where: { branchId, status: TicketStatus.COMPLETED, createdAt: { gte: from } } }),
      this.prisma.queueTicket.count({ where: { branchId, status: TicketStatus.NO_SHOW, createdAt: { gte: from } } }),
      this.prisma.queueTicket.count({ where: { branchId, status: TicketStatus.CANCELLED, createdAt: { gte: from } } }),
      this.prisma.queueTicket.aggregate({
        where: { branchId, status: TicketStatus.COMPLETED, waitSeconds: { not: null }, createdAt: { gte: from } },
        _avg: { waitSeconds: true },
      }),
    ]);

    return {
      totalTickets,
      completedTickets,
      noShowTickets,
      cancelledTickets,
      completionRate: totalTickets > 0 ? completedTickets / totalTickets : 0,
      avgWaitSeconds: Math.round(avgWait._avg.waitSeconds || 0),
    };
  }

  async getServiceBreakdown(branchId: string, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    return this.prisma.queueTicket.groupBy({
      by: ['serviceId'],
      where: { branchId, createdAt: { gte: from } },
      _count: { id: true },
      _avg: { waitSeconds: true },
    });
  }

  async getHourlyBreakdown(branchId: string, date: string) {
    const d = new Date(date);
    const start = new Date(d.setHours(0, 0, 0, 0));
    const end = new Date(d.setHours(24, 0, 0, 0));

    const tickets = await this.prisma.queueTicket.findMany({
      where: { branchId, createdAt: { gte: start, lt: end } },
      select: { createdAt: true, status: true },
    });

    const hourly: Record<number, { total: number; completed: number }> = {};
    for (let h = 0; h < 24; h++) hourly[h] = { total: 0, completed: 0 };
    for (const t of tickets) {
      const h = t.createdAt.getHours();
      hourly[h].total++;
      if (t.status === TicketStatus.COMPLETED) hourly[h].completed++;
    }
    return hourly;
  }

  async getSnapshots(branchId: string, serviceId?: string, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    return this.prisma.analyticsSnapshot.findMany({
      where: { branchId, ...(serviceId ? { serviceId } : {}), date: { gte: from } },
      orderBy: [{ date: 'asc' }, { hour: 'asc' }],
    });
  }
}
