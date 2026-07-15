import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateCounterGroupDto, UpdateCounterGroupDto, CreateCounterDto, UpdateCounterDto } from './dto/counter.dto.js';

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

  async createGroup(organizationId: string, dto: CreateCounterGroupDto) {
    return this.prisma.counterGroup.create({ data: { organizationId, name: dto.name } });
  }

  async updateGroup(id: string, dto: UpdateCounterGroupDto, scopeOrgId?: string) {
    if (scopeOrgId) {
      const group = await this.prisma.counterGroup.findUnique({ where: { id } });
      if (!group || group.organizationId !== scopeOrgId) throw new NotFoundException('Counter group not found');
    }
    return this.prisma.counterGroup.update({ where: { id }, data: dto });
  }

  // ── Counters ───────────────────────────────────────────────────────────

  async findAllByBranch(branchId: string, scopeOrgId?: string) {
    if (scopeOrgId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch || branch.organizationId !== scopeOrgId) throw new ForbiddenException('That branch does not belong to your organization.');
    }
    return this.prisma.counter.findMany({
      where: { branchId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string, scopeOrgId?: string) {
    const c = await this.prisma.counter.findFirst({
      where: { id, ...(scopeOrgId ? { branch: { organizationId: scopeOrgId } } : {}) },
      include: { group: true },
    });
    if (!c) throw new NotFoundException('Counter not found');
    return c;
  }

  async create(dto: CreateCounterDto, scopeOrgId?: string) {
    if (scopeOrgId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch || branch.organizationId !== scopeOrgId) throw new ForbiddenException('That branch does not belong to your organization.');
    }
    const code = dto.code.toUpperCase();
    const exists = await this.prisma.counter.findUnique({ where: { branchId_code: { branchId: dto.branchId, code } } });
    if (exists) throw new ConflictException('Counter code already exists in this branch');
    return this.prisma.counter.create({ data: { ...dto, code } });
  }

  async update(id: string, dto: UpdateCounterDto, scopeOrgId?: string) {
    await this.findOne(id, scopeOrgId);
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
