import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async dashboardMe(@CurrentUser() user: any, @Query('days') days?: string) {
    const branchId = user?.branchId || '';
    if (!branchId) return { success: true, data: { totalTickets: 0, completedTickets: 0, noShowTickets: 0, cancelledTickets: 0, completionRate: 0, avgWaitSeconds: 0 } };
    return { success: true, data: await this.analyticsService.getDashboard(branchId, days ? Number(days) : 7) };
  }

  @Get('dashboard/:branchId')
  async dashboard(@Param('branchId') branchId: string, @Query('days') days?: string) {
    return { success: true, data: await this.analyticsService.getDashboard(branchId, days ? Number(days) : 7) };
  }

  @Get('services/:branchId')
  async services(@Param('branchId') branchId: string, @Query('days') days?: string) {
    return { success: true, data: await this.analyticsService.getServiceBreakdown(branchId, days ? Number(days) : 7) };
  }

  @Get('hourly/:branchId')
  async hourly(@Param('branchId') branchId: string, @Query('date') date: string) {
    return { success: true, data: await this.analyticsService.getHourlyBreakdown(branchId, date || new Date().toISOString().slice(0, 10)) };
  }

  @Get('snapshots/:branchId')
  async snapshots(@Param('branchId') branchId: string, @Query('serviceId') serviceId?: string, @Query('days') days?: string) {
    return { success: true, data: await this.analyticsService.getSnapshots(branchId, serviceId, days ? Number(days) : 30) };
  }
}
