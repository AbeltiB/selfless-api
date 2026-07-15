import { Module, forwardRef } from '@nestjs/common';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { JobQueueModule } from '../../common/queue/job-queue.module.js';

@Module({
  imports: [NotificationsModule, RealtimeModule, WorkflowsModule, JobQueueModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
