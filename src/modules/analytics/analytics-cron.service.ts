import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JobQueueService } from '../../common/queue/job-queue.service.js';

/**
 * Registers one hourly repeatable ANALYTICS_AGGREGATE job per active organization at boot.
 * BullMQ dedupes repeatable jobs by jobId, so re-running this on every restart is safe. Orgs
 * created after boot won't get a cron job until the next restart — acceptable for the Phase 1
 * stub processor; revisit if/when real aggregation logic lands and this needs to react live.
 */
@Injectable()
export class AnalyticsCronService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsCronService.name);

  constructor(
    private prisma: PrismaService,
    private jobQueue: JobQueueService,
  ) {}

  async onModuleInit() {
    const orgs = await this.prisma.organization.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    for (const org of orgs) {
      await this.jobQueue.registerAnalyticsCron(org.id);
    }
    this.logger.log(`Registered hourly analytics aggregation cron for ${orgs.length} organization(s)`);
  }
}
