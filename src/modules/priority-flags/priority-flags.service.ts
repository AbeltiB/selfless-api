import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePriorityFlagDto, UpdatePriorityFlagDto, AssignPriorityFlagDto } from './dto/priority-flag.dto.js';

@Injectable()
export class PriorityFlagsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.priorityFlag.findMany({
      where: { organizationId },
      orderBy: { weight: 'desc' },
    });
  }

  async create(organizationId: string, dto: CreatePriorityFlagDto) {
    const existing = await this.prisma.priorityFlag.findUnique({ where: { organizationId_name: { organizationId, name: dto.name } } });
    if (existing) throw new ConflictException(`A priority flag named '${dto.name}' already exists.`);
    return this.prisma.priorityFlag.create({
      data: { organizationId, name: dto.name, description: dto.description, weight: dto.weight ?? 10, color: dto.color, isActive: true },
    });
  }

  async update(id: string, dto: UpdatePriorityFlagDto, scopeOrgId?: string) {
    const flag = await this.assertInScope(id, scopeOrgId);
    return this.prisma.priorityFlag.update({ where: { id }, data: dto });
  }

  async remove(id: string, scopeOrgId?: string) {
    await this.assertInScope(id, scopeOrgId);
    return this.prisma.priorityFlag.update({ where: { id }, data: { isActive: false } });
  }

  async assign(id: string, dto: AssignPriorityFlagDto, assignedBy: string, scopeOrgId?: string) {
    await this.assertInScope(id, scopeOrgId);
    return this.prisma.accountPriorityFlag.upsert({
      where: { accountId_flagId: { accountId: dto.accountId, flagId: id } },
      create: { accountId: dto.accountId, flagId: id, assignedBy, notes: dto.notes, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null },
      update: { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null, notes: dto.notes, assignedBy },
    });
  }

  async unassign(id: string, accountId: string, scopeOrgId?: string) {
    await this.assertInScope(id, scopeOrgId);
    await this.prisma.accountPriorityFlag.deleteMany({ where: { flagId: id, accountId } });
  }

  async findAssignedToAccount(accountId: string, organizationId: string) {
    return this.prisma.accountPriorityFlag.findMany({
      where: { accountId, flag: { organizationId } },
      include: { flag: true },
    });
  }

  private async assertInScope(id: string, scopeOrgId?: string) {
    const flag = await this.prisma.priorityFlag.findUnique({ where: { id } });
    if (!flag || (scopeOrgId && flag.organizationId !== scopeOrgId)) throw new NotFoundException('Priority flag not found');
    return flag;
  }
}
