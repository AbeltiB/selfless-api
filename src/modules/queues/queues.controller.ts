import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { QueuesService } from './queues.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyAccount } from '../../common/decorators/any-account.decorator.js';
import { UserRole } from 'selfless-sdk';
import { OpenQueueDto, UpdateQueueStatusDto, CallNextDto } from './dto/queue.dto.js';

const ANY_STAFF = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];

@Controller('queues')
export class QueuesController {
  constructor(private svc: QueuesService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get()
  @Roles(...ANY_STAFF)
  findAll(@Query() q: any, @CurrentUser() user: any) {
    return this.svc.findAll(q, this.scopeFor(user));
  }

  @Get(':id')
  @AnyAccount()
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/stats')
  @AnyAccount()
  stats(@Param('id') id: string) {
    return this.svc.getStats(id);
  }

  @Post('open')
  @Roles(...ANY_STAFF)
  open(@Body() dto: OpenQueueDto, @CurrentUser() user: any) {
    return this.svc.open(dto, this.scopeFor(user));
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateQueueStatusDto, @CurrentUser() user: any) {
    return this.svc.updateStatus(id, dto.status, this.scopeFor(user));
  }

  @Post(':id/call-next')
  @Roles(...ANY_STAFF)
  callNext(@Param('id') id: string, @Body() dto: CallNextDto, @CurrentUser() user: any) {
    return this.svc.callNext(id, user.id, dto.counterId, this.scopeFor(user));
  }
}
