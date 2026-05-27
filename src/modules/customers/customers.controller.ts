import { Controller, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('customers')
export class CustomersController {
  constructor(private svc: CustomersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR)
  findAll(@Query('organizationId') orgId?: string) { return this.svc.findAll(orgId); }

  @Get('me')
  getMyProfile(@CurrentUser() user: any) { return this.svc.findOne(user.id); }

  @Patch('me')
  updateMyProfile(@CurrentUser() user: any, @Body() body: any) {
    return this.svc.updateProfile(user.id, body);
  }

  @Get('me/tickets')
  myTickets(@CurrentUser() user: any) { return this.svc.getTicketHistory(user.id); }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }
}
