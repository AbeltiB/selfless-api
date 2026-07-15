import { Controller, Get, Post, Patch, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AppointmentStatus, UserRole } from 'selfless-sdk';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyAccount } from '../../common/decorators/any-account.decorator.js';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/appointment.dto.js';

const ANY_STAFF = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];

@Controller('appointments')
export class AppointmentsController {
  constructor(private svc: AppointmentsService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get()
  @Roles(...ANY_STAFF)
  findAll(@Query() q: any, @CurrentUser() user: any) {
    return this.svc.findAll(q, this.scopeFor(user));
  }

  @Get('slots')
  @AnyAccount()
  slots(@Query('branchId') branchId: string, @Query('serviceId') serviceId: string, @Query('date') date: string) {
    return this.svc.getAvailableSlots(branchId, serviceId, date);
  }

  @Get('my')
  @AnyAccount()
  myAppointments(@CurrentUser() user: any) {
    return this.svc.findAll({ customerId: user.id });
  }

  @Get(':id')
  @AnyAccount()
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOne(id, { scopeOrgId: this.scopeFor(user), selfAccountId: user.id });
  }

  @Post()
  @AnyAccount()
  book(@Body() dto: CreateAppointmentDto, @CurrentUser() user: any) {
    // Staff booking on behalf of someone always uses their own active org — never a client-supplied one.
    // A caller with no org membership (a customer) must say which business they're booking with.
    const organizationId = user.activeOrgId ?? dto.organizationId;
    if (!organizationId) throw new BadRequestException('organizationId is required.');
    const isStaff = !!user.activeOrgId;
    return this.svc.create(organizationId, dto, isStaff ? undefined : user.id);
  }

  @Patch(':id/status')
  @Roles(...ANY_STAFF)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto, @CurrentUser() user: any) {
    return this.svc.updateStatus(id, dto.status, this.scopeFor(user));
  }

  @Post(':id/check-in')
  @Roles(...ANY_STAFF)
  checkIn(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.checkIn(id, this.scopeFor(user));
  }
}
