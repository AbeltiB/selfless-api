import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, RepeatOptions } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES, TicketExpiryJob, TicketSlaJob, AnalyticsAggregateJob } from 'selfless-sdk';

@Injectable()
export class JobQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);
  private connection: Redis;
  private ticketExpiryQueue: Queue<TicketExpiryJob>;
  private ticketSlaQueue: Queue<TicketSlaJob>;
  private analyticsQueue: Queue<AnalyticsAggregateJob>;

  constructor() {
    this.connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.connection.on('error', (err) => this.logger.error(`Redis connection error: ${err.message}`));
    this.ticketExpiryQueue = new Queue(QUEUE_NAMES.TICKET_EXPIRY, { connection: this.connection });
    this.ticketSlaQueue = new Queue(QUEUE_NAMES.TICKET_SLA, { connection: this.connection });
    this.analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS_AGGREGATE, { connection: this.connection });
  }

  async enqueueTicketExpiry(job: TicketExpiryJob, delayMs: number) {
    await this.ticketExpiryQueue.add('expire', job, { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
  }

  async enqueueTicketSla(job: TicketSlaJob, delayMs: number) {
    await this.ticketSlaQueue.add('check-sla', job, { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
  }

  /** One repeatable hourly job per organization — jobId dedupes so re-registering on every boot is safe (idempotent). */
  async registerAnalyticsCron(organizationId: string, pattern: RepeatOptions['pattern'] = '5 * * * *') {
    await this.analyticsQueue.add(
      'aggregate-hourly',
      { organizationId, timestamp: new Date().toISOString(), date: '', hour: 0 },
      { repeat: { pattern }, jobId: `analytics-cron:${organizationId}` },
    );
  }

  async onModuleDestroy() {
    await this.connection.quit();
  }
}
