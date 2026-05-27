import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { QueuesService } from './queues.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole, QueueStatus } from 'selfless-sdk';

@Controller('queues')
export class QueuesController {
  constructor(private svc: QueuesService) {}

  @Get()
  findAll(@Query() q: any) { return this.svc.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get(':id/stats')
  stats(@Param('id') id: string) { return this.svc.getStats(id); }

  @Post('open')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  open(@Body() body: any) { return this.svc.open(body); }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR)
  updateStatus(@Param('id') id: string, @Body() body: { status: QueueStatus }) {
    return this.svc.updateStatus(id, body.status);
  }

  @Post(':id/call-next')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  callNext(@Param('id') id: string, @Body() body: { counterId?: string }, @CurrentUser() user: any) {
    return this.svc.callNext(id, user.id, body.counterId);
  }
}
