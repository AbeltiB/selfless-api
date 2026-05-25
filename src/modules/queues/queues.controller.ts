import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { QueuesService } from './queues.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole, TicketStatus, QueueStatus } from 'selfless-sdk';

@Controller('queues')
export class QueuesController {
  constructor(private queuesService: QueuesService) {}

  @Get()
  async findAll(@Query('branchId') branchId?: string, @Query('date') date?: string) {
    return { success: true, data: await this.queuesService.findAll(branchId, date) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.queuesService.findOne(id) };
  }

  @Get(':id/stats')
  async stats(@Param('id') id: string) {
    return { success: true, data: await this.queuesService.getQueueStats(id) };
  }

  @Get(':id/tickets')
  async tickets(@Param('id') id: string, @Query('status') status?: TicketStatus) {
    return { success: true, data: await this.queuesService.getQueueTickets(id, status) };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER, UserRole.OPERATOR)
  async open(@Body() body: { branchId: string; serviceId: string }) {
    return { success: true, data: await this.queuesService.openQueue(body) };
  }

  @Post('open')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER, UserRole.OPERATOR)
  async openExplicit(@Body() body: { branchId: string; serviceId: string }) {
    return { success: true, data: await this.queuesService.openQueue(body) };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER, UserRole.OPERATOR)
  async updateStatus(@Param('id') id: string, @Body('status') status: QueueStatus) {
    return { success: true, data: await this.queuesService.updateQueueStatus(id, status) };
  }

  @Post(':id/issue')
  async issueTicket(@Param('id') id: string, @Body() body: any) {
    return { success: true, data: await this.queuesService.issueTicket(id, body) };
  }

  @Post(':id/call-next')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER, UserRole.OPERATOR)
  async callNext(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.queuesService.callNext(id, user.id, body.counterNumber) };
  }

  @Patch('tickets/:ticketId/status')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER, UserRole.OPERATOR, UserRole.STAFF)
  async transitionTicket(@Param('ticketId') ticketId: string, @Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.queuesService.transitionTicket(ticketId, body.status, user.id, body) };
  }
}
