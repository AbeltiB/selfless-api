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

  // ── Identity & auth ────────────────────────────────────────────────────────
  get account() { return this._db.account; }
  get orgMembership() { return this._db.orgMembership; }
  get otpVerification() { return this._db.otpVerification; }
  get trustedDevice() { return this._db.trustedDevice; }

  // ── Priority / fairness flags ──────────────────────────────────────────────
  get priorityFlag() { return this._db.priorityFlag; }
  get accountPriorityFlag() { return this._db.accountPriorityFlag; }
  get ticketPriorityFlag() { return this._db.ticketPriorityFlag; }

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

  // maxWait/timeout above Prisma's 2s/5s defaults: advisory-lock-serialized transactions
  // (e.g. ticket-number generation) can legitimately queue behind each other under real
  // concurrent load against a remote DB, and the default timeout is too tight for that queueing.
  $transaction<T>(fn: (tx: PrismaInstance) => Promise<T>): Promise<T> {
    return this._db.$transaction(fn as any, { maxWait: 10000, timeout: 15000 }) as Promise<T>;
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
