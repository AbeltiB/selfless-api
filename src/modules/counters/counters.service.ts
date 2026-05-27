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
}
