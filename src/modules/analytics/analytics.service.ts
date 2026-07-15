import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TicketStatus } from 'selfless-sdk';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async assertBranchInScope(branchId: string, scopeOrgId?: string) {
    if (!scopeOrgId || !branchId) return;
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.organizationId !== scopeOrgId) {
      throw new ForbiddenException('That branch does not belong to your organization.');
    }
  }

  async getDashboard(branchId: string, organizationId: string | undefined, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const baseWhere = {
      ...(branchId ? { branchId } : {}),
      ...(organizationId ? { organizationId } : {}),
      createdAt: { gte: from },
    };

    const [totalTickets, completedTickets, noShowTickets, cancelledTickets, avgWait] = await Promise.all([
      this.prisma.ticket.count({ where: baseWhere }),
      this.prisma.ticket.count({ where: { ...baseWhere, status: TicketStatus.COMPLETED } }),
      this.prisma.ticket.count({ where: { ...baseWhere, status: TicketStatus.NO_SHOW } }),
      this.prisma.ticket.count({ where: { ...baseWhere, status: TicketStatus.CANCELLED } }),
      this.prisma.ticket.aggregate({
        where: { ...baseWhere, status: TicketStatus.COMPLETED, waitSeconds: { not: null } },
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

  async getServiceBreakdown(branchId: string, organizationId?: string, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    return this.prisma.ticket.groupBy({
      by: ['serviceId'],
      where: {
        ...(branchId ? { branchId } : {}),
        ...(organizationId ? { organizationId } : {}),
        createdAt: { gte: from },
      },
      _count: { id: true },
      _avg: { waitSeconds: true },
    });
  }

  async getHourlyBreakdown(branchId: string, date: string) {
    const d = new Date(date);
    const start = new Date(d.setHours(0, 0, 0, 0));
    const end = new Date(d.setHours(24, 0, 0, 0));

    const tickets = await this.prisma.ticket.findMany({
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

  async getSnapshots(branchId: string, serviceId?: string, organizationId?: string, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    return this.prisma.analyticsSnapshot.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(organizationId ? { organizationId } : {}),
        date: { gte: from },
      },
      orderBy: [{ date: 'asc' }, { hour: 'asc' }],
    });
  }
}
