import { Module } from '@nestjs/common';
import { QueuesService } from './queues.service.js';
import { QueuesController } from './queues.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [QueuesController],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
