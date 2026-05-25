import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES, NotificationEmailJob } from 'selfless-sdk';

const DEMO_TENANT_ID = 'demo-tenant-001';

@Injectable()
export class NotificationsService {
  private emailQueue: Queue;

  constructor() {
    const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    this.emailQueue = new Queue(QUEUE_NAMES.NOTIFICATION_EMAIL, { connection });
  }

  async sendEmail(to: string, subject: string, body: string, html?: string) {
    const job: NotificationEmailJob = {
      tenantId: DEMO_TENANT_ID,
      timestamp: new Date().toISOString(),
      to,
      subject,
      body,
      html,
    };
    await this.emailQueue.add('send', job, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  }

  async sendWelcomeEmail(to: string, name: string) {
    await this.sendEmail(
      to,
      'Welcome to SelfLess',
      `Hi ${name},\n\nWelcome to the SelfLess platform. Your account has been created.\n\nBest regards,\nThe SelfLess Team`,
    );
  }
}
