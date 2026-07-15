import { Inject, Injectable, BadRequestException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OtpPurpose } from 'selfless-sdk';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OTP_PROVIDER, type OtpProvider } from './otp-provider.interface.js';

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_TOKEN_KIND = 'otp-token';
const RESEND_COOLDOWN_SECONDS = 30;

interface OtpTokenPayload {
  phone: string;
  purpose: OtpPurpose;
  kind: typeof OTP_TOKEN_KIND;
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    @Inject(OTP_PROVIDER) private provider: OtpProvider,
  ) {}

  async requestOtp(phone: string, purpose: OtpPurpose, requestIp?: string): Promise<{ expiresInSeconds: number }> {
    const recent = await this.prisma.otpVerification.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
      throw new HttpException('Please wait before requesting another code.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.otpVerification.create({
      data: { phone, purpose, codeHash, expiresAt, requestIp },
    });

    await this.provider.send(phone, code, purpose);

    return { expiresInSeconds: OTP_TTL_MINUTES * 60 };
  }

  /** Verifies a code and returns a short-lived otpToken that a follow-up step (set-pin/login/reset-pin) must present. */
  async verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<{ otpToken: string }> {
    const record = await this.prisma.otpVerification.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new BadRequestException('No pending code for this phone number. Request a new one.');
    if (record.expiresAt < new Date()) throw new BadRequestException('Code expired. Request a new one.');
    if (record.attempts >= record.maxAttempts) throw new BadRequestException('Too many incorrect attempts. Request a new code.');

    const valid = await bcrypt.compare(code, record.codeHash);
    if (!valid) {
      await this.prisma.otpVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Incorrect code.');
    }

    await this.prisma.otpVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

    const payload: OtpTokenPayload = { phone, purpose, kind: OTP_TOKEN_KIND };
    const otpToken = this.jwt.sign(payload, { expiresIn: '5m' });
    return { otpToken };
  }

  /** Redeems (and invalidates by expiry naturally) an otpToken for a specific purpose, returning the verified phone. */
  verifyOtpToken(otpToken: string, expectedPurpose: OtpPurpose): string {
    let payload: OtpTokenPayload;
    try {
      payload = this.jwt.verify<OtpTokenPayload>(otpToken);
    } catch {
      throw new UnauthorizedException('OTP verification expired or invalid — please verify again.');
    }
    if (payload.kind !== OTP_TOKEN_KIND || payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException('OTP verification does not match this action.');
    }
    return payload.phone;
  }
}
