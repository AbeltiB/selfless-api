import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    return this.prisma.service.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: { select: { id: true, name: true } }, _count: { select: { queues: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const svc = await this.prisma.service.findUnique({
      where: { id },
      include: { branch: true },
    });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async create(dto: { branchId: string; name: string; code: string; description?: string; estimatedDuration?: number; prefix?: string }) {
    const exists = await this.prisma.service.findUnique({ where: { branchId_code: { branchId: dto.branchId, code: dto.code } } });
    if (exists) throw new ConflictException(`Service code '${dto.code}' already exists in this branch`);
    return this.prisma.service.create({ data: dto });
  }

  async update(id: string, dto: { name?: string; description?: string; estimatedDuration?: number; prefix?: string; isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.service.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
