import { Controller, Get, Post, Patch, Body, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TicketsService, TicketViewer } from './tickets.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyAccount } from '../../common/decorators/any-account.decorator.js';
import { UserRole } from 'selfless-sdk';
import { IssueTicketDto, SelfIssueTicketDto, TransitionTicketDto, AdvanceTicketDto, TransferTicketDto } from './dto/ticket.dto.js';

const ANY_STAFF = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];

@Controller('tickets')
export class TicketsController {
  constructor(private svc: TicketsService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  private viewerFor(user: any): TicketViewer {
    return { accountId: user.id, activeOrgId: user.activeOrgId, isSuperAdmin: user.activeRole === UserRole.SUPER_ADMIN };
  }

  @Get('export')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR)
  async exportCsv(@Query() query: any, @CurrentUser() user: any, @Res() res: Response) {
    const tickets = await this.svc.findAll(query, this.scopeFor(user));
    const header = 'id,queueNumber,status,service,branch,customer,priority,issuedAt,calledAt,servedAt,completedAt,waitSeconds,serviceSeconds,notes\n';
    const rows = tickets.map((t: any) =>
      [
        t.id,
        t.queueNumber,
        t.status,
        t.service?.name ?? '',
        t.branch?.name ?? '',
        t.customer ? `${t.customer.firstName} ${t.customer.lastName ?? ''}`.trim() : 'Walk-in',
        t.priority,
        t.issuedAt ?? '',
        t.calledAt ?? '',
        t.servedAt ?? '',
        t.completedAt ?? '',
        t.waitSeconds ?? '',
        t.serviceSeconds ?? '',
        (t.notes ?? '').replace(/,/g, ' ').replace(/\n/g, ' '),
      ].join(','),
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tickets-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(header + rows);
  }

  @Get()
  @Roles(...ANY_STAFF)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.svc.findAll(query, this.scopeFor(user));
  }

  @Get(':id')
  @AnyAccount()
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOne(id, this.viewerFor(user));
  }

  @Get(':id/transitions')
  @AnyAccount()
  getTransitions(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getAvailableTransitions(id, this.viewerFor(user));
  }

  @Post()
  @Roles(...ANY_STAFF)
  issue(@Body() dto: IssueTicketDto, @CurrentUser() user: any) {
    return this.svc.issue(user.activeOrgId, dto);
  }

  @Post('self-issue')
  @AnyAccount()
  selfIssue(@Body() dto: SelfIssueTicketDto, @CurrentUser() user: any) {
    // Self-issue is reachable by a logged-in customer (no org membership); organizationId is
    // the business the customer chose, not derived from a membership they don't have.
    return this.svc.issue(dto.organizationId, dto, user.id);
  }

  @Patch(':id/status')
  @Roles(...ANY_STAFF)
  transition(@Param('id') id: string, @Body() dto: TransitionTicketDto, @CurrentUser() user: any) {
    return this.svc.transition(id, dto.status, user.id, { counterId: dto.counterId, notes: dto.notes }, this.scopeFor(user));
  }

  @Patch(':id/advance')
  @Roles(...ANY_STAFF)
  advanceStep(@Param('id') id: string, @Body() dto: AdvanceTicketDto, @CurrentUser() user: any) {
    return this.svc.advanceStep(id, dto.transitionId, user.id, this.scopeFor(user));
  }

  @Patch(':id/transfer')
  @Roles(...ANY_STAFF)
  transfer(@Param('id') id: string, @Body() dto: TransferTicketDto, @CurrentUser() user: any) {
    return this.svc.transfer(id, user.id, dto, this.scopeFor(user));
  }
}
