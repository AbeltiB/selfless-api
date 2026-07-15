import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class PinService {
  constructor(private prisma: PrismaService) {}

  hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, 12);
  }

  /** Throws if the account is locked or the PIN is wrong; records failure/success as a side effect. */
  async verifyPin(account: { id: string; pinHash: string | null; pinFailedAttempts: number; pinLockedUntil: Date | null }, pin: string): Promise<void> {
    if (account.pinLockedUntil && account.pinLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((account.pinLockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Too many incorrect PIN attempts. Try again in ${minutesLeft} minute(s).`);
    }
    if (!account.pinHash) {
      throw new UnauthorizedException('No PIN set for this account yet.');
    }

    const valid = await bcrypt.compare(pin, account.pinHash);
    if (!valid) {
      const attempts = account.pinFailedAttempts + 1;
      const locked = attempts >= MAX_PIN_ATTEMPTS;
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          pinFailedAttempts: locked ? 0 : attempts,
          pinLockedUntil: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException(locked ? `Too many incorrect PIN attempts. Try again in ${LOCKOUT_MINUTES} minute(s).` : 'Incorrect PIN.');
    }

    if (account.pinFailedAttempts > 0 || account.pinLockedUntil) {
      await this.prisma.account.update({ where: { id: account.id }, data: { pinFailedAttempts: 0, pinLockedUntil: null } });
    }
  }
}
