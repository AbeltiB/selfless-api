import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CountersService {
  constructor(private prisma: PrismaService) {}

  // ── Counter Groups ─────────────────────────────────────────────────────

  async findAllGroups(organizationId: string) {
    return this.prisma.counterGroup.findMany({
      where: { organizationId },
      include: { counters: { select: { id: true, name: true, code: true, isActive: true } } },
    });
  }

  async createGroup(dto: { organizationId: string; name: string }) {
    return this.prisma.counterGroup.create({ data: dto });
  }

  async updateGroup(id: string, dto: { name: string }) {
    return this.prisma.counterGroup.update({ where: { id }, data: dto });
  }

  // ── Counters ───────────────────────────────────────────────────────────

  async findAllByBranch(branchId: string) {
    return this.prisma.counter.findMany({
      where: { branchId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.counter.findUnique({ where: { id }, include: { group: true } });
    if (!c) throw new NotFoundException('Counter not found');
    return c;
  }

  async create(dto: { branchId: string; groupId?: string; name: string; code: string }) {
    const exists = await this.prisma.counter.findUnique({
      where: { branchId_code: { branchId: dto.branchId, code: dto.code.toUpperCase() } },
    });
    if (exists) throw new ConflictException('Counter code already exists in this branch');
    return this.prisma.counter.create({ data: { ...dto, code: dto.code.toUpperCase() } });
  }

  async update(id: string, dto: { name?: string; groupId?: string; isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.counter.update({ where: { id }, data: dto });
  }

  async getDisplayBoard(branchId: string) {
    const counters = await this.prisma.counter.findMany({
      where: { branchId, isActive: true },
      include: {
        group: { select: { id: true, name: true } },
        currentTickets: {
          where: { status: { in: ['CALLED', 'IN_SERVICE'] } },
          orderBy: { calledAt: 'desc' },
          take: 1,
          include: { service: { select: { id: true, name: true } } },
        },
      },
      orderBy: { code: 'asc' },
    });

    return counters.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      group: c.group,
      nowServing: c.currentTickets[0]
        ? {
            queueNumber: c.currentTickets[0].queueNumber,
            status: c.currentTickets[0].status,
            service: c.currentTickets[0].service,
            calledAt: c.currentTickets[0].calledAt,
          }
        : null,
    }));
  }
}
