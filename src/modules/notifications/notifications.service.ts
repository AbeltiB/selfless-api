import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES, NotificationEmailJob, NotificationTelegramJob } from 'selfless-sdk';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private emailQueue: Queue;
  private telegramQueue: Queue;
  private connection: Redis;

  constructor() {
    this.connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    this.emailQueue = new Queue(QUEUE_NAMES.NOTIFICATION_EMAIL, { connection: this.connection });
    this.telegramQueue = new Queue(QUEUE_NAMES.NOTIFICATION_TELEGRAM, { connection: this.connection });
  }

  async sendEmail(to: string, subject: string, body: string, html?: string, meta?: { ticketId?: string; customerId?: string; organizationId?: string }) {
    const job: NotificationEmailJob = {
      organizationId: meta?.organizationId ?? 'system',
      timestamp: new Date().toISOString(),
      to, subject, body, html,
      ticketId: meta?.ticketId,
      customerId: meta?.customerId,
    };
    await this.emailQueue.add('send', job, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  }

  async sendTelegram(telegramId: string, message: string, meta?: { ticketId?: string; customerId?: string; organizationId?: string }) {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — skipping Telegram notification');
      return;
    }
    const job: NotificationTelegramJob = {
      organizationId: meta?.organizationId ?? 'system',
      timestamp: new Date().toISOString(),
      telegramId, message,
      ticketId: meta?.ticketId,
      customerId: meta?.customerId,
    };
    await this.telegramQueue.add('send', job, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  }

  async sendWelcomeEmail(to: string, name: string) {
    await this.sendEmail(to, 'Welcome to SelfLess', `Hi ${name},\n\nYour account has been created.\n\nThe SelfLess Team`);
  }
}
