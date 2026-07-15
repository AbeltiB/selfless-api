import { Injectable, Logger } from '@nestjs/common';
import type { OtpPurpose } from 'selfless-sdk';
import type { OtpProvider, OtpSendResult } from './otp-provider.interface.js';

/**
 * Dev-only stub: logs the code instead of sending a real SMS/WhatsApp message.
 * Must not be used once a real provider is wired in — a logged OTP code is an
 * OTP bypass if this ever reaches a production log aggregator.
 */
@Injectable()
export class DevConsoleOtpProvider implements OtpProvider {
  private readonly logger = new Logger(DevConsoleOtpProvider.name);

  async send(phone: string, code: string, purpose: OtpPurpose): Promise<OtpSendResult> {
    this.logger.warn(`[DEV OTP] ${purpose} code for ${phone}: ${code}`);
    return { success: true };
  }
}
