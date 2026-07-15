import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

const ANALYSTS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR];

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get('dashboard')
  @Roles(...ANALYSTS)
  async dashboardMe(@CurrentUser() user: any, @Query('days') days?: string) {
    const branchId = user?.activeBranchId || '';
    const organizationId = user?.activeOrgId;
    if (!branchId && !organizationId) {
      return { success: true, data: { totalTickets: 0, completedTickets: 0, noShowTickets: 0, cancelledTickets: 0, completionRate: 0, avgWaitSeconds: 0 } };
    }
    return { success: true, data: await this.analyticsService.getDashboard(branchId, organizationId, days ? Number(days) : 7) };
  }

  @Get('dashboard/:branchId')
  @Roles(...ANALYSTS)
  async dashboard(@Param('branchId') branchId: string, @CurrentUser() user: any, @Query('days') days?: string) {
    const scopeOrgId = this.scopeFor(user);
    await this.analyticsService.assertBranchInScope(branchId, scopeOrgId);
    return { success: true, data: await this.analyticsService.getDashboard(branchId, scopeOrgId, days ? Number(days) : 7) };
  }

  @Get('services/:branchId')
  @Roles(...ANALYSTS)
  async services(@Param('branchId') branchId: string, @CurrentUser() user: any, @Query('days') days?: string) {
    const scopeOrgId = this.scopeFor(user);
    await this.analyticsService.assertBranchInScope(branchId, scopeOrgId);
    return { success: true, data: await this.analyticsService.getServiceBreakdown(branchId, scopeOrgId, days ? Number(days) : 7) };
  }

  @Get('hourly/:branchId')
  @Roles(...ANALYSTS)
  async hourly(@Param('branchId') branchId: string, @CurrentUser() user: any, @Query('date') date: string) {
    await this.analyticsService.assertBranchInScope(branchId, this.scopeFor(user));
    return { success: true, data: await this.analyticsService.getHourlyBreakdown(branchId, date || new Date().toISOString().slice(0, 10)) };
  }

  @Get('snapshots/:branchId')
  @Roles(...ANALYSTS)
  async snapshots(@Param('branchId') branchId: string, @CurrentUser() user: any, @Query('serviceId') serviceId?: string, @Query('days') days?: string) {
    const scopeOrgId = this.scopeFor(user);
    await this.analyticsService.assertBranchInScope(branchId, scopeOrgId);
    return { success: true, data: await this.analyticsService.getSnapshots(branchId, serviceId, scopeOrgId, days ? Number(days) : 30) };
  }
}
