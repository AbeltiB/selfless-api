import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId?: string) {
    return this.prisma.customer.findMany({
      where: organizationId ? { organizationId } : {},
      include: { _count: { select: { tickets: true, appointments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        tickets: { orderBy: { createdAt: 'desc' }, take: 10, include: { service: { select: { name: true } }, branch: { select: { name: true } } } },
        appointments: { orderBy: { scheduledAt: 'desc' }, take: 5 },
      },
    });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  async updateProfile(id: string, dto: { phone?: string; email?: string; firstName?: string; lastName?: string }) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found');

    if (dto.phone && dto.phone !== c.phone) {
      const exists = await this.prisma.customer.findUnique({ where: { phone: dto.phone } });
      if (exists && exists.id !== id) throw new ConflictException('Phone number already registered');
    }

    const profileComplete = !!(dto.phone || c.phone);
    return this.prisma.customer.update({
      where: { id },
      data: { ...dto, profileComplete },
    });
  }

  async getTicketHistory(customerId: string) {
    return this.prisma.ticket.findMany({
      where: { customerId },
      include: {
        service: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        currentStep: { select: { id: true, name: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
