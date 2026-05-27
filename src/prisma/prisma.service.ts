import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

type PrismaInstance = InstanceType<typeof PrismaClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private _db!: PrismaInstance;

  get db(): PrismaInstance { return this._db; }

  // ── Core entities ──────────────────────────────────────────────────────────
  get organization() { return this._db.organization; }
  get branch() { return this._db.branch; }
  get user() { return this._db.user; }
  get customer() { return this._db.customer; }

  // ── Workflow ───────────────────────────────────────────────────────────────
  get workflow() { return this._db.workflow; }
  get workflowStep() { return this._db.workflowStep; }
  get workflowTransition() { return this._db.workflowTransition; }

  // ── Counter ────────────────────────────────────────────────────────────────
  get counterGroup() { return this._db.counterGroup; }
  get counter() { return this._db.counter; }

  // ── Service & forms ────────────────────────────────────────────────────────
  get service() { return this._db.service; }
  get requirement() { return this._db.requirement; }
  get form() { return this._db.form; }
  get formField() { return this._db.formField; }

  // ── Queue & ticket ─────────────────────────────────────────────────────────
  get queue() { return this._db.queue; }
  get ticket() { return this._db.ticket; }
  get ticketEvent() { return this._db.ticketEvent; }

  // ── Appointments & ops ─────────────────────────────────────────────────────
  get appointment() { return this._db.appointment; }
  get notification() { return this._db.notification; }
  get auditLog() { return this._db.auditLog; }
  get analyticsSnapshot() { return this._db.analyticsSnapshot; }

  $transaction<T>(fn: (tx: PrismaInstance) => Promise<T>): Promise<T> {
    return this._db.$transaction(fn as any) as Promise<T>;
  }

  async onModuleInit() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const adapter = new PrismaPg({ connectionString: url });
    this._db = new PrismaClient({ adapter }) as PrismaInstance;
    await this._db.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this._db.$disconnect();
  }
}
