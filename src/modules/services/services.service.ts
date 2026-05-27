import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: { branchId?: string; organizationId?: string }) {
    return this.prisma.service.findMany({
      where: {
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.organizationId ? { branch: { organizationId: filter.organizationId } } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        workflow: { select: { id: true, name: true } },
        _count: { select: { queues: true, requirements: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const svc = await this.prisma.service.findUnique({
      where: { id },
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

  async create(dto: { branchId: string; name: string; code: string; description?: string; estimatedDuration?: number; prefix?: string; workflowId?: string; serviceType?: string }) {
    const exists = await this.prisma.service.findUnique({ where: { branchId_code: { branchId: dto.branchId, code: dto.code.toUpperCase() } } });
    if (exists) throw new ConflictException(`Service code '${dto.code}' already exists in this branch`);
    return this.prisma.service.create({ data: { ...dto, code: dto.code.toUpperCase() } as any });
  }

  async update(id: string, dto: { name?: string; description?: string; estimatedDuration?: number; prefix?: string; isActive?: boolean; workflowId?: string; serviceType?: string }) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: { isActive: false } });
  }
}
