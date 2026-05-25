import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.branch.findMany({
      include: { _count: { select: { services: true, queues: true, users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { services: { where: { isActive: true } }, _count: { select: { users: true, queues: true } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(dto: { name: string; code: string; address?: string; timezone?: string; maxQueueCapacity?: number }) {
    const exists = await this.prisma.branch.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Branch code '${dto.code}' already exists`);
    return this.prisma.branch.create({ data: dto });
  }

  async update(id: string, dto: { name?: string; address?: string; timezone?: string; maxQueueCapacity?: number; isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.branch.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
