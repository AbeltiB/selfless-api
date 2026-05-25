import { Controller, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QueuesService } from '../queues/queues.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole, TicketStatus } from 'selfless-sdk';

@Controller('tickets')
export class TicketsController {
  constructor(
    private prisma: PrismaService,
    private queuesService: QueuesService,
  ) {}

  @Get()
  async findAll(@Query('limit') limit?: string, @Query('branchId') branchId?: string) {
    const take = limit ? Math.min(Number(limit), 100) : 20;
    const tickets = await this.prisma.queueTicket.findMany({
      where: branchId ? { branchId } : undefined,
      take,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, operator: { select: { id: true, name: true } } },
    });
    return { success: true, data: tickets };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const ticket = await this.prisma.queueTicket.findUnique({
      where: { id },
      include: { customer: true, queue: true, operator: { select: { id: true, name: true } } },
    });
    return { success: true, data: ticket };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER, UserRole.OPERATOR, UserRole.STAFF)
  async updateStatus(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.queuesService.transitionTicket(id, body.status as TicketStatus, user.id, body) };
  }
}
