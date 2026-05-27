import { Module, forwardRef } from '@nestjs/common';
import { QueuesService } from './queues.service.js';
import { QueuesController } from './queues.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';

@Module({
  imports: [NotificationsModule, RealtimeModule, forwardRef(() => TicketsModule)],
  controllers: [QueuesController],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
