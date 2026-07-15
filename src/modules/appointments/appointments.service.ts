import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { AppointmentStatus } from 'selfless-sdk';
import { CreateAppointmentDto } from './dto/appointment.dto.js';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private tickets: TicketsService,
  ) {}

  async findAll(filter: { branchId?: string; serviceId?: string; customerId?: string; date?: string; status?: string }, scopeOrgId?: string) {
    const where: any = {};
    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.serviceId) where.serviceId = filter.serviceId;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.status) where.status = filter.status;
    if (scopeOrgId) where.organizationId = scopeOrgId;
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
      take: 500,
    });
  }

  async findOne(id: string, access?: { scopeOrgId?: string; selfAccountId?: string }) {
    const a = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, branch: true, customer: true },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    if (access) {
      const ownsAsStaff = !!access.scopeOrgId && a.organizationId === access.scopeOrgId;
      const ownsAsSelf = !!access.selfAccountId && a.customerId === access.selfAccountId;
      const isSuperAdminBypass = access.scopeOrgId === undefined && access.selfAccountId === undefined;
      if (!ownsAsStaff && !ownsAsSelf && !isSuperAdminBypass) throw new NotFoundException('Appointment not found');
    }
    return a;
  }

  async create(organizationId: string, dto: CreateAppointmentDto, selfCustomerId?: string) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) throw new BadRequestException('Appointment must be in the future');

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId }, include: { branch: true } });
    if (!service || service.serviceType === 'WALK_IN') throw new BadRequestException('Service does not accept appointments');
    if (service.branch.organizationId !== organizationId || service.branchId !== dto.branchId) {
      throw new ForbiddenException('That branch/service does not belong to this organization.');
    }

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

    const customerId = selfCustomerId ?? dto.customerId;
    const appt = await this.prisma.appointment.create({
      data: { organizationId, branchId: dto.branchId, serviceId: dto.serviceId, customerId: customerId ?? null, scheduledAt, duration: dto.duration ?? 30, notes: dto.notes ?? null, status: AppointmentStatus.PENDING },
      include: { service: { select: { name: true } }, branch: { select: { name: true } }, customer: true },
    });

    if (appt.customer?.telegramId) {
      const when = scheduledAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      this.notifications.sendTelegram(appt.customer.telegramId, `📅 Appointment confirmed at *${appt.branch.name}* for *${appt.service.name}* on ${when}.`).catch(() => {});
    }

    return appt;
  }

  async updateStatus(id: string, status: AppointmentStatus, scopeOrgId?: string) {
    const appt = await this.findOne(id, { scopeOrgId });
    const updated = await this.prisma.appointment.update({ where: { id }, data: { status } });

    if (status === AppointmentStatus.CONFIRMED && appt.customer?.telegramId) {
      this.notifications.sendTelegram(appt.customer.telegramId, `✅ Your appointment has been confirmed!`).catch(() => {});
    }
    if (status === AppointmentStatus.CANCELLED && appt.customer?.telegramId) {
      this.notifications.sendTelegram(appt.customer.telegramId, `❌ Your appointment has been cancelled.`).catch(() => {});
    }

    return updated;
  }

  async checkIn(id: string, scopeOrgId?: string) {
    const appt = await this.findOne(id, { scopeOrgId });

    // Atomic claim: only one concurrent check-in call can flip PENDING/CONFIRMED -> CHECKED_IN.
    // A second simultaneous call sees count 0 and is rejected before ever issuing a ticket.
    const claim = await this.prisma.appointment.updateMany({
      where: { id, status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] } },
      data: { status: AppointmentStatus.CHECKED_IN },
    });
    if (claim.count === 0) {
      throw new ConflictException('Appointment already checked in or cannot be checked in.');
    }

    const ticket = await this.tickets.issue(appt.organizationId, {
      branchId: appt.branchId,
      serviceId: appt.serviceId,
      customerId: appt.customerId ?? undefined,
      notes: `Appointment ${appt.scheduledAt.toISOString()}`,
      priorityFlagIds: [],
    });

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { ticketId: ticket.id },
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
