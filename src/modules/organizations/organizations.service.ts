import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organization.findMany({
      include: { _count: { select: { branches: true, users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        branches: { select: { id: true, name: true, code: true, status: true } },
        _count: { select: { branches: true, users: true, workflows: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(dto: { name: string; code: string; logo?: string }) {
    const existing = await this.prisma.organization.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (existing) throw new ConflictException('Organization code already in use');
    return this.prisma.organization.create({
      data: { ...dto, code: dto.code.toUpperCase(), status: 'ACTIVE' } as any,
    });
  }

  async update(id: string, dto: { name?: string; logo?: string; status?: string; settings?: any }) {
    await this.findOne(id);
    return this.prisma.organization.update({ where: { id }, data: dto as any });
  }
}
