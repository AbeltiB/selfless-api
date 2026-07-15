import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsCronService } from './analytics-cron.service.js';
import { JobQueueModule } from '../../common/queue/job-queue.module.js';

@Module({
  imports: [JobQueueModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsCronService],
})
export class AnalyticsModule {}
