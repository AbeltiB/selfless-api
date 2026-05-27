import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentsController } from './appointments.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
