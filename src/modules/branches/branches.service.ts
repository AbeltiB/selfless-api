import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateBranchDto } from './dto/create-branch.dto.js';
import { UpdateBranchDto } from './dto/update-branch.dto.js';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  /** scopeOrgId: undefined only for SUPER_ADMIN browsing across all orgs. */
  async findAll(scopeOrgId?: string) {
    return this.prisma.branch.findMany({
      where: scopeOrgId ? { organizationId: scopeOrgId } : {},
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { services: true, counters: true, memberships: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, scopeOrgId?: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, ...(scopeOrgId ? { organizationId: scopeOrgId } : {}) },
      include: {
        organization: { select: { id: true, name: true } },
        services: { where: { isActive: true }, include: { workflow: { select: { id: true, name: true } } } },
        counters: { where: { isActive: true }, include: { group: { select: { id: true, name: true } } } },
        _count: { select: { memberships: true, tickets: true } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(organizationId: string, dto: CreateBranchDto) {
    const code = dto.code.toUpperCase();
    const exists = await this.prisma.branch.findUnique({ where: { organizationId_code: { organizationId, code } } });
    if (exists) throw new ConflictException(`Branch code '${dto.code}' already exists in this organization`);
    return this.prisma.branch.create({ data: { ...dto, organizationId, code, status: 'ACTIVE' } });
  }

  async update(id: string, dto: UpdateBranchDto, scopeOrgId?: string) {
    await this.findOne(id, scopeOrgId);
    return this.prisma.branch.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, scopeOrgId?: string) {
    await this.findOne(id, scopeOrgId);
    return this.prisma.branch.update({ where: { id }, data: { status: 'INACTIVE' } });
  }
}
