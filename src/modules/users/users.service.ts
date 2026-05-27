import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole } from 'selfless-sdk';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter?: { branchId?: string; organizationId?: string }) {
    return this.prisma.user.findMany({
      where: {
        ...(filter?.branchId ? { branchId: filter.branchId } : {}),
        ...(filter?.organizationId ? { organizationId: filter.organizationId } : {}),
      },
      select: { id: true, email: true, name: true, role: true, branchId: true, organizationId: true, isActive: true, createdAt: true, lastLoginAt: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async create(dto: { email: string; password: string; name: string; role?: UserRole; branchId?: string; organizationId?: string }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name, role: dto.role || UserRole.OFFICER, branchId: dto.branchId, organizationId: dto.organizationId },
    });
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async update(id: string, dto: { name?: string; role?: UserRole; branchId?: string; isActive?: boolean; password?: string }) {
    await this.findOne(id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.branchId !== undefined) data.branchId = dto.branchId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.update({ where: { id }, data });
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
