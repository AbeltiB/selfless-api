import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';
import { ServicesModule } from './modules/services/services.module.js';
import { WorkflowsModule } from './modules/workflows/workflows.module.js';
import { CountersModule } from './modules/counters/counters.module.js';
import { QueuesModule } from './modules/queues/queues.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { AppointmentsModule } from './modules/appointments/appointments.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { RequirementsModule } from './modules/requirements/requirements.module.js';
import { FormsModule } from './modules/forms/forms.module.js';
import { MembershipsModule } from './modules/memberships/memberships.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { PriorityFlagsModule } from './modules/priority-flags/priority-flags.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { ServiceAuthGuard } from './common/guards/service-auth.guard.js';

@Module({
  imports: [
    // Global default: 60 req/min per IP. Auth endpoints override this with a tighter
    // per-route @Throttle() — see auth.controller.ts.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    BranchesModule,
    ServicesModule,
    WorkflowsModule,
    CountersModule,
    QueuesModule,
    TicketsModule,
    AppointmentsModule,
    NotificationsModule,
    AnalyticsModule,
    RealtimeModule,
    RequirementsModule,
    FormsModule,
    MembershipsModule,
    AccountsModule,
    PriorityFlagsModule,
  ],
  providers: [
    // All APP_GUARD entries run for every request, in this order, and every one must pass —
    // ThrottlerGuard first so a spammed request is rejected before spending cycles on JWT
    // verification. JwtAuthGuard/RolesGuard both no-op (return true) for @ServiceAuth() routes;
    // ServiceAuthGuard is what actually authenticates those.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ServiceAuthGuard },
  ],
})
export class AppModule {}
