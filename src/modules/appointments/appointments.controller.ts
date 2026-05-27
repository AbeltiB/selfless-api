import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AppointmentStatus, UserRole } from 'selfless-sdk';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('appointments')
export class AppointmentsController {
  constructor(private svc: AppointmentsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  findAll(@Query() q: any) { return this.svc.findAll(q); }

  @Get('slots')
  slots(@Query('branchId') branchId: string, @Query('serviceId') serviceId: string, @Query('date') date: string) {
    return this.svc.getAvailableSlots(branchId, serviceId, date);
  }

  @Get('my')
  myAppointments(@CurrentUser() user: any) { return this.svc.findAll({ customerId: user.id }); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  book(@Body() body: any, @CurrentUser() user: any) {
    const customerId = user?.type === 'customer' ? user.id : body.customerId;
    return this.svc.create({ ...body, customerId });
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  updateStatus(@Param('id') id: string, @Body() body: { status: AppointmentStatus }) {
    return this.svc.updateStatus(id, body.status);
  }

  @Post(':id/check-in')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  checkIn(@Param('id') id: string) { return this.svc.checkIn(id); }
}
