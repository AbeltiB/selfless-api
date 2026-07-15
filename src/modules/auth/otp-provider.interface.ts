import type { OtpPurpose } from 'selfless-sdk';

export const OTP_PROVIDER = Symbol('OTP_PROVIDER');

export interface OtpSendResult {
  success: boolean;
  providerRef?: string;
}

/**
 * Delivery boundary for OTP codes. The real HTTP gateway implementation is a
 * separate follow-up (swap the `useClass`/`useFactory` binding in auth.module.ts) —
 * nothing else in the auth module should ever import a concrete provider directly.
 */
export interface OtpProvider {
  send(phone: string, code: string, purpose: OtpPurpose): Promise<OtpSendResult>;
}
