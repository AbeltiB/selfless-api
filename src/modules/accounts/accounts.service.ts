import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

const SANITIZE_SELECT = {
  id: true, phone: true, firstName: true, lastName: true, email: true,
  telegramId: true, telegramUsername: true, photoUrl: true,
  addressLine1: true, addressLine2: true, city: true, region: true, country: true, dateOfBirth: true,
  status: true, lastLoginAt: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async me(accountId: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, select: SANITIZE_SELECT });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async updateMe(accountId: string, dto: UpdateAccountDto) {
    const data: any = { ...dto };
    if (dto.dateOfBirth) data.dateOfBirth = new Date(dto.dateOfBirth);
    return this.prisma.account.update({ where: { id: accountId }, data, select: SANITIZE_SELECT });
  }

  async myTickets(accountId: string) {
    return this.prisma.ticket.findMany({
      where: { customerId: accountId },
      include: {
        service: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        currentStep: { select: { id: true, name: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });
  }

  /** Accounts with at least one ticket or appointment at this org — the "customers of this org" view. */
  async findAllForOrg(organizationId: string) {
    return this.prisma.account.findMany({
      where: {
        OR: [
          { tickets: { some: { organizationId } } },
          { appointments: { some: { organizationId } } },
        ],
      },
      select: SANITIZE_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async findOneForOrg(id: string, organizationId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        id,
        OR: [
          { tickets: { some: { organizationId } } },
          { appointments: { some: { organizationId } } },
        ],
      },
      select: SANITIZE_SELECT,
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }
}
