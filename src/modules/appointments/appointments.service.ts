import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { AppointmentStatus } from 'selfless-sdk';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private tickets: TicketsService,
  ) {}

  async findAll(filter: { branchId?: string; serviceId?: string; customerId?: string; date?: string; status?: string }) {
    const where: any = {};
    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.serviceId) where.serviceId = filter.serviceId;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.status) where.status = filter.status;
    if (filter.date) {
      const d = new Date(filter.date); d.setHours(0, 0, 0, 0);
      const d2 = new Date(filter.date); d2.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: d, lte: d2 };
    }
    return this.prisma.appointment.findMany({
      where,
      include: {
        service: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, telegramId: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const a = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, branch: true, customer: true },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    return a;
  }

  async create(dto: {
    organizationId: string;
    branchId: string;
    serviceId: string;
    customerId?: string;
    scheduledAt: string;
    duration?: number;
    notes?: string;
  }) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) throw new BadRequestException('Appointment must be in the future');

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service || (service.serviceType === 'WALK_IN')) throw new BadRequestException('Service does not accept appointments');

    // Slot conflict check
    const slotEnd = new Date(scheduledAt.getTime() + (dto.duration ?? 30) * 60000);
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        branchId: dto.branchId,
        serviceId: dto.serviceId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN] },
        scheduledAt: { lt: slotEnd },
        AND: [{ scheduledAt: { gte: scheduledAt } }],
      },
    });
    if (conflict) throw new BadRequestException('Time slot not available');

    const appt = await this.prisma.appointment.create({
      data: { organizationId: dto.organizationId, branchId: dto.branchId, serviceId: dto.serviceId, customerId: dto.customerId ?? null, scheduledAt, duration: dto.duration ?? 30, notes: dto.notes ?? null, status: AppointmentStatus.PENDING },
      include: { service: { select: { name: true } }, branch: { select: { name: true } }, customer: true },
    });

    // Telegram confirmation
    if (appt.customer?.telegramId) {
      const when = scheduledAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      this.notifications.sendTelegram(appt.customer.telegramId, `📅 Appointment confirmed at *${appt.branch.name}* for *${appt.service.name}* on ${when}.`).catch(() => {});
    }

    return appt;
  }

  async updateStatus(id: string, status: AppointmentStatus) {
    const appt = await this.findOne(id);
    const updated = await this.prisma.appointment.update({ where: { id }, data: { status } });

    if (status === AppointmentStatus.CONFIRMED && appt.customer?.telegramId) {
      this.notifications.sendTelegram(appt.customer.telegramId, `✅ Your appointment has been confirmed!`).catch(() => {});
    }
    if (status === AppointmentStatus.CANCELLED && appt.customer?.telegramId) {
      this.notifications.sendTelegram(appt.customer.telegramId, `❌ Your appointment has been cancelled.`).catch(() => {});
    }

    return updated;
  }

  async checkIn(id: string) {
    const appt = await this.findOne(id);
    if (appt.status !== AppointmentStatus.CONFIRMED && appt.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException('Appointment cannot be checked in');
    }

    // Issue a queue ticket for the appointment — priority above walk-ins
    const ticket = await this.tickets.issue({
      organizationId: appt.organizationId,
      branchId: appt.branchId,
      serviceId: appt.serviceId,
      customerId: appt.customerId ?? undefined,
      priority: 1,
      notes: `Appointment ${appt.scheduledAt.toISOString()}`,
    });

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CHECKED_IN, ticketId: ticket.id },
      include: { service: { select: { id: true, name: true } }, customer: true },
    });

    return { appointment, ticket };
  }

  async getAvailableSlots(branchId: string, serviceId: string, date: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    const duration = service.estimatedDuration || 30;
    const day = new Date(date); day.setHours(8, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(17, 0, 0, 0);

    const booked = await this.prisma.appointment.findMany({
      where: { branchId, serviceId, scheduledAt: { gte: day, lte: dayEnd }, status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN] } },
      select: { scheduledAt: true, duration: true },
    });

    const slots: string[] = [];
    let cursor = new Date(day);
    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + duration * 60000);
      const isTaken = booked.some((b) => {
        const bEnd = new Date(b.scheduledAt.getTime() + (b.duration ?? 30) * 60000);
        return cursor < bEnd && slotEnd > b.scheduledAt;
      });
      if (!isTaken) slots.push(cursor.toISOString());
      cursor = new Date(cursor.getTime() + duration * 60000);
    }
    return slots;
  }
}
