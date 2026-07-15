import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES, NotificationEmailJob, NotificationTelegramJob, NotificationChannel } from 'selfless-sdk';
import { PrismaService } from '../../prisma/prisma.service.js';

type NotifyMeta = { ticketId?: string; customerId?: string; organizationId?: string };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private emailQueue: Queue;
  private telegramQueue: Queue;
  private connection: Redis;

  constructor(private prisma: PrismaService) {
    this.connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    this.connection.on('error', (err) => this.logger.error(`Redis connection error: ${err.message}`));
    this.emailQueue = new Queue(QUEUE_NAMES.NOTIFICATION_EMAIL, { connection: this.connection });
    this.telegramQueue = new Queue(QUEUE_NAMES.NOTIFICATION_TELEGRAM, { connection: this.connection });
  }

  async sendEmail(to: string, subject: string, body: string, html?: string, meta?: NotifyMeta) {
    const job: NotificationEmailJob = {
      organizationId: meta?.organizationId ?? 'system',
      timestamp: new Date().toISOString(),
      to, subject, body, html,
      ticketId: meta?.ticketId,
      customerId: meta?.customerId,
    };
    await this.emailQueue.add('send', job, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    await this.logNotification(NotificationChannel.EMAIL, subject, body, { ...meta, to });
  }

  async sendTelegram(telegramId: string, message: string, meta?: NotifyMeta) {
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
    await this.logNotification(NotificationChannel.TELEGRAM, undefined, message, { ...meta, telegramId });
  }

  async sendWelcomeEmail(to: string, name: string) {
    // No org context yet at signup time — this row is intentionally not logged to Notification
    // (it's not org-scoped data), only enqueued for delivery.
    await this.sendEmail(to, 'Welcome to SelfLess', `Hi ${name},\n\nYour account has been created.\n\nThe SelfLess Team`);
  }

  async findAll(organizationId: string | undefined, filter: { channel?: string; status?: string; take: number; skip: number }) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (filter.channel) where.channel = filter.channel;
    if (filter.status) where.status = filter.status;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: filter.take, skip: filter.skip }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, take: filter.take, skip: filter.skip };
  }

  /** Best-effort audit row — a failure here must never block the actual send. */
  private async logNotification(channel: NotificationChannel, subject: string | undefined, body: string, meta: NotifyMeta & Record<string, unknown>) {
    if (!meta.organizationId) return;
    await this.prisma.notification.create({
      data: {
        organizationId: meta.organizationId,
        channel,
        recipientId: meta.customerId ?? null,
        subject: subject ?? null,
        body,
        metadata: { ticketId: meta.ticketId ?? null },
      },
    }).catch((err) => this.logger.error(`Failed to log notification row: ${err.message}`));
  }
}
