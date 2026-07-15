import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: { branchId?: string }, scopeOrgId?: string) {
    return this.prisma.service.findMany({
      where: {
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(scopeOrgId ? { branch: { organizationId: scopeOrgId } } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        workflow: { select: { id: true, name: true } },
        _count: { select: { queues: true, requirements: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, scopeOrgId?: string) {
    const svc = await this.prisma.service.findFirst({
      where: { id, ...(scopeOrgId ? { branch: { organizationId: scopeOrgId } } : {}) },
      include: {
        branch: { select: { id: true, name: true } },
        workflow: { include: { steps: { orderBy: { order: 'asc' } } } },
        requirements: { orderBy: { order: 'asc' } },
        forms: { where: { isActive: true }, include: { fields: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async create(dto: CreateServiceDto, scopeOrgId?: string) {
    if (scopeOrgId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch || branch.organizationId !== scopeOrgId) {
        throw new ForbiddenException('That branch does not belong to your organization.');
      }
    }
    const code = dto.code.toUpperCase();
    const exists = await this.prisma.service.findUnique({ where: { branchId_code: { branchId: dto.branchId, code } } });
    if (exists) throw new ConflictException(`Service code '${dto.code}' already exists in this branch`);
    return this.prisma.service.create({ data: { ...dto, code } as any });
  }

  async update(id: string, dto: UpdateServiceDto, scopeOrgId?: string) {
    await this.findOne(id, scopeOrgId);
    return this.prisma.service.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, scopeOrgId?: string) {
    await this.findOne(id, scopeOrgId);
    return this.prisma.service.update({ where: { id }, data: { isActive: false } });
  }
}
