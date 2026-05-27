import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('tickets')
export class TicketsController {
  constructor(private svc: TicketsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  findAll(@Query() query: any) { return this.svc.findAll(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get(':id/transitions')
  getTransitions(@Param('id') id: string) { return this.svc.getAvailableTransitions(id); }

  @Post()
  issue(@Body() body: any, @CurrentUser() user: any) {
    return this.svc.issue({ ...body, organizationId: body.organizationId ?? user?.organizationId });
  }

  @Post('self-issue')
  selfIssue(@CurrentUser() user: any, @Body() body: any) {
    return this.svc.issue({ ...body, customerId: user.id, organizationId: body.organizationId });
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  transition(@Param('id') id: string, @Body() body: { status: string; counterId?: string; notes?: string }, @CurrentUser() user: any) {
    return this.svc.transition(id, body.status as any, user.id, { counterId: body.counterId, notes: body.notes });
  }

  @Patch(':id/advance')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  advanceStep(@Param('id') id: string, @Body() body: { transitionId: string }, @CurrentUser() user: any) {
    return this.svc.advanceStep(id, body.transitionId, user.id);
  }
}
