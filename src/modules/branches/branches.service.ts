import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId?: string) {
    return this.prisma.branch.findMany({
      where: organizationId ? { organizationId } : {},
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { services: true, counters: true, users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        services: { where: { isActive: true }, include: { workflow: { select: { id: true, name: true } } } },
        counters: { where: { isActive: true }, include: { group: { select: { id: true, name: true } } } },
        _count: { select: { users: true, tickets: true } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(dto: { organizationId: string; name: string; code: string; address?: string; latitude?: number; longitude?: number; timezone?: string; maxCapacity?: number }) {
    const exists = await this.prisma.branch.findUnique({ where: { organizationId_code: { organizationId: dto.organizationId, code: dto.code.toUpperCase() } } });
    if (exists) throw new ConflictException(`Branch code '${dto.code}' already exists in this organization`);
    return this.prisma.branch.create({ data: { ...dto, code: dto.code.toUpperCase(), status: 'ACTIVE' } });
  }

  async update(id: string, dto: { name?: string; address?: string; latitude?: number; longitude?: number; timezone?: string; maxCapacity?: number; status?: string; operatingHours?: any }) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: { status: 'INACTIVE' } });
  }
}
