import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';

const DEVICE_TRUST_DAYS = 60;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class DeviceTrustService {
  constructor(private prisma: PrismaService) {}

  async issueDevice(accountId: string, meta?: { userAgent?: string; ip?: string }): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.trustedDevice.create({
      data: {
        accountId,
        deviceTokenHash: hashToken(rawToken),
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        expiresAt: new Date(Date.now() + DEVICE_TRUST_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return rawToken;
  }

  /** Returns the trusted device id if the token is valid for this account, else null. */
  async verifyDevice(accountId: string, rawToken: string | undefined): Promise<string | null> {
    if (!rawToken) return null;
    const device = await this.prisma.trustedDevice.findUnique({ where: { deviceTokenHash: hashToken(rawToken) } });
    if (!device || device.accountId !== accountId) return null;
    if (device.revokedAt || device.expiresAt < new Date()) return null;

    await this.prisma.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
    return device.id;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.prisma.trustedDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
  }

  async revokeAllForAccount(accountId: string): Promise<void> {
    await this.prisma.trustedDevice.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
