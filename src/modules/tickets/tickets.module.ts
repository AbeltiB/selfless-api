import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller.js';
import { QueuesModule } from '../queues/queues.module.js';

@Module({
  imports: [QueuesModule],
  controllers: [TicketsController],
})
export class TicketsModule {}
