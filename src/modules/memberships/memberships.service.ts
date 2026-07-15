import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole } from 'selfless-sdk';
import { InviteMemberDto, UpdateMembershipDto } from './dto/membership.dto.js';

const ACCOUNT_SELECT = { id: true, phone: true, firstName: true, lastName: true, email: true, status: true, lastLoginAt: true } as const;

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  /** ORG_ADMIN can hand out any role except SUPER_ADMIN — that requires being SUPER_ADMIN yourself. */
  private assertCanAssignRole(actorRole: UserRole, targetRole: UserRole) {
    if (actorRole === UserRole.SUPER_ADMIN) return;
    if (targetRole === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a SUPER_ADMIN can grant the SUPER_ADMIN role.');
    }
  }

  async findAll(organizationId: string, branchId?: string) {
    return this.prisma.orgMembership.findMany({
      where: { organizationId, ...(branchId ? { branchId } : {}) },
      include: { account: { select: ACCOUNT_SELECT }, branch: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invite(organizationId: string, dto: InviteMemberDto, actorRole: UserRole) {
    this.assertCanAssignRole(actorRole, dto.role);

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch || branch.organizationId !== organizationId) {
        throw new ForbiddenException('That branch does not belong to your organization.');
      }
    }

    const account = await this.prisma.account.upsert({
      where: { phone: dto.phone },
      create: { phone: dto.phone, firstName: dto.firstName ?? 'New', lastName: dto.lastName },
      update: {},
    });

    const existing = await this.prisma.orgMembership.findUnique({
      where: { accountId_organizationId: { accountId: account.id, organizationId } },
    });
    if (existing) throw new ConflictException('This phone number is already a member of your organization.');

    return this.prisma.orgMembership.create({
      data: { accountId: account.id, organizationId, branchId: dto.branchId, role: dto.role, isActive: true, invitedAt: new Date() },
      include: { account: { select: ACCOUNT_SELECT }, branch: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateMembershipDto, organizationId: string, actorRole: UserRole) {
    const membership = await this.prisma.orgMembership.findUnique({ where: { id } });
    if (!membership || membership.organizationId !== organizationId) throw new NotFoundException('Membership not found');

    if (dto.role) this.assertCanAssignRole(actorRole, dto.role);
    if (membership.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a SUPER_ADMIN can modify another SUPER_ADMIN.');
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch || branch.organizationId !== organizationId) {
        throw new ForbiddenException('That branch does not belong to your organization.');
      }
    }

    return this.prisma.orgMembership.update({
      where: { id },
      data: dto,
      include: { account: { select: ACCOUNT_SELECT }, branch: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string, organizationId: string, actorRole: UserRole, actorAccountId: string) {
    const membership = await this.prisma.orgMembership.findUnique({ where: { id } });
    if (!membership || membership.organizationId !== organizationId) throw new NotFoundException('Membership not found');
    if (membership.accountId === actorAccountId) throw new ForbiddenException('You cannot remove your own membership.');
    if (membership.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a SUPER_ADMIN can remove another SUPER_ADMIN.');
    }
    return this.prisma.orgMembership.update({ where: { id }, data: { isActive: false } });
  }
}
