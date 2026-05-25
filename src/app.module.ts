import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';
import { ServicesModule } from './modules/services/services.module.js';
import { QueuesModule } from './modules/queues/queues.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    ServicesModule,
    QueuesModule,
    NotificationsModule,
    AnalyticsModule,
    RealtimeModule,
    TicketsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
