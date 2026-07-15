import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose } from 'selfless-sdk';
import { PrismaService } from '../../prisma/prisma.service.js';
import { requireEnv } from '../../common/utils/require-env.util.js';
import { OtpService } from './otp.service.js';
import { PinService } from './pin.service.js';
import { DeviceTrustService } from './device-trust.service.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 10;
const SESSION_STALE_DAYS = 10;

interface ActiveContext {
  activeOrgId?: string;
  activeBranchId?: string;
  activeRole?: string;
}

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otp: OtpService,
    private pin: PinService,
    private deviceTrust: DeviceTrustService,
  ) {}

  // ── OTP passthrough (rate limiting lives at the controller via @Throttle) ──

  requestOtp(phone: string, purpose: OtpPurpose, requestIp?: string) {
    return this.otp.requestOtp(phone, purpose, requestIp);
  }

  verifyOtp(phone: string, purpose: OtpPurpose, code: string) {
    return this.otp.verifyOtp(phone, purpose, code);
  }

  // ── Signup completion (first OTP verify → set PIN + profile) ─────────────

  async setPin(otpToken: string, pin: string, firstName: string, lastName: string | undefined, email: string | undefined, meta: RequestMeta) {
    const phone = this.otp.verifyOtpToken(otpToken, OtpPurpose.SIGNUP);
    const pinHash = await this.pin.hashPin(pin);

    let account = await this.prisma.account.findUnique({ where: { phone } });
    if (account?.pinHash) {
      throw new ConflictException('This phone number already has an account. Use login instead.');
    }

    account = account
      ? await this.prisma.account.update({
          where: { id: account.id },
          data: { pinHash, firstName, lastName, email, lastLoginAt: new Date() },
        })
      : await this.prisma.account.create({
          data: { phone, firstName, lastName, email, pinHash, lastLoginAt: new Date() },
        });

    return this.issueSession(account.id, meta);
  }

  // ── Login (phone + PIN, OTP only when device/session is untrusted/stale) ──

  async login(phone: string, pinCode: string, otpToken: string | undefined, rawDeviceToken: string | undefined, meta: RequestMeta) {
    const account = await this.prisma.account.findUnique({ where: { phone } });
    if (!account) throw new UnauthorizedException('Invalid phone number or PIN.');

    await this.pin.verifyPin(account, pinCode);

    const trustedDeviceId = await this.deviceTrust.verifyDevice(account.id, rawDeviceToken);
    const sessionFresh = !!account.lastLoginAt && Date.now() - account.lastLoginAt.getTime() < SESSION_STALE_DAYS * 24 * 60 * 60 * 1000;

    if (trustedDeviceId && sessionFresh) {
      await this.prisma.account.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
      const ctx = await this.resolveDefaultActiveContext(account.id);
      return { otpRequired: false as const, ...(await this.signTokens(account.id, trustedDeviceId, ctx)), account: this.sanitizeAccount(account) };
    }

    if (!otpToken) {
      return { otpRequired: true as const, purpose: OtpPurpose.LOGIN };
    }

    const verifiedPhone = this.otp.verifyOtpToken(otpToken, OtpPurpose.LOGIN);
    if (verifiedPhone !== phone) throw new UnauthorizedException('OTP does not match this phone number.');

    await this.prisma.account.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    const session = await this.issueSession(account.id, meta);
    return { otpRequired: false as const, ...session };
  }

  // ── PIN reset (OTP-gated, revokes all trusted devices) ───────────────────

  async resetPin(otpToken: string, newPin: string, meta: RequestMeta) {
    const phone = this.otp.verifyOtpToken(otpToken, OtpPurpose.PIN_RESET);
    const account = await this.prisma.account.findUnique({ where: { phone } });
    if (!account) throw new UnauthorizedException('Account not found.');

    const pinHash = await this.pin.hashPin(newPin);
    await this.prisma.account.update({
      where: { id: account.id },
      data: { pinHash, pinFailedAttempts: 0, pinLockedUntil: null },
    });
    await this.deviceTrust.revokeAllForAccount(account.id);

    return this.issueSession(account.id, meta);
  }

  // ── Refresh (re-verifies active org membership against the DB) ───────────

  async refresh(refreshToken: string) {
    let payload: { sub: string; deviceId?: string; activeOrgId?: string; type: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: requireEnv('JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'account-refresh') throw new UnauthorizedException('Invalid refresh token');

    const account = await this.prisma.account.findUnique({ where: { id: payload.sub } });
    if (!account || account.status !== 'ACTIVE') throw new UnauthorizedException('Account not found or inactive');

    let ctx: ActiveContext = {};
    if (payload.activeOrgId) {
      const membership = await this.prisma.orgMembership.findUnique({
        where: { accountId_organizationId: { accountId: account.id, organizationId: payload.activeOrgId } },
      });
      if (membership?.isActive) {
        ctx = { activeOrgId: membership.organizationId, activeBranchId: membership.branchId ?? undefined, activeRole: membership.role };
      }
      // else: membership was revoked since the refresh token was issued — silently drop org context, forcing a fresh switch-org.
    }

    const accessToken = this.signAccessToken(account.id, account.phone, payload.deviceId, ctx);
    return { accessToken, activeOrgId: ctx.activeOrgId, activeBranchId: ctx.activeBranchId, activeRole: ctx.activeRole };
  }

  // ── Switch active organization (always re-verified against the DB) ───────

  async switchOrg(accountId: string, organizationId: string, deviceId: string | undefined) {
    const membership = await this.prisma.orgMembership.findUnique({
      where: { accountId_organizationId: { accountId, organizationId } },
    });
    if (!membership || !membership.isActive) {
      throw new ForbiddenException('No active membership in that organization.');
    }
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    const ctx: ActiveContext = { activeOrgId: membership.organizationId, activeBranchId: membership.branchId ?? undefined, activeRole: membership.role };
    return this.signTokens(accountId, deviceId, ctx, account.phone);
  }

  // ── Me ─────────────────────────────────────────────────────────────────

  async getMe(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { memberships: { where: { isActive: true }, include: { organization: true, branch: true } } },
    });
    if (!account) throw new UnauthorizedException();
    return this.sanitizeAccount(account);
  }

  // ── Logout ─────────────────────────────────────────────────────────────

  async logout(deviceId: string | undefined, revokeDevice: boolean) {
    if (revokeDevice && deviceId) {
      await this.deviceTrust.revokeDevice(deviceId);
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async issueSession(accountId: string, meta: RequestMeta) {
    const rawDeviceToken = await this.deviceTrust.issueDevice(accountId, meta);
    const device = await this.prisma.trustedDevice.findFirst({ where: { accountId }, orderBy: { createdAt: 'desc' } });
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    const ctx = await this.resolveDefaultActiveContext(accountId);
    const tokens = await this.signTokens(accountId, device!.id, ctx, account.phone);
    return { ...tokens, deviceToken: rawDeviceToken, account: this.sanitizeAccount(account) };
  }

  /** If the account has exactly one active org membership, pre-select it; otherwise leave org context unset. */
  private async resolveDefaultActiveContext(accountId: string): Promise<ActiveContext> {
    const memberships = await this.prisma.orgMembership.findMany({ where: { accountId, isActive: true } });
    if (memberships.length === 1) {
      const m = memberships[0];
      return { activeOrgId: m.organizationId, activeBranchId: m.branchId ?? undefined, activeRole: m.role };
    }
    return {};
  }

  private signAccessToken(accountId: string, phone: string, deviceId: string | undefined, ctx: ActiveContext) {
    return this.jwtService.sign(
      { sub: accountId, phone, deviceId, ...ctx, type: 'account' },
      { secret: requireEnv('JWT_SECRET'), expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  private signRefreshToken(accountId: string, deviceId: string | undefined, ctx: ActiveContext) {
    return this.jwtService.sign(
      { sub: accountId, deviceId, activeOrgId: ctx.activeOrgId, type: 'account-refresh' },
      { secret: requireEnv('JWT_REFRESH_SECRET'), expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` },
    );
  }

  private async signTokens(accountId: string, deviceId: string | undefined, ctx: ActiveContext, phone?: string) {
    const accountPhone = phone ?? (await this.prisma.account.findUniqueOrThrow({ where: { id: accountId } })).phone;
    return {
      accessToken: this.signAccessToken(accountId, accountPhone, deviceId, ctx),
      refreshToken: this.signRefreshToken(accountId, deviceId, ctx),
      // Exposed alongside the (opaque) tokens so the frontend never needs to decode the JWT
      // itself just to know which org/role is active.
      activeOrgId: ctx.activeOrgId,
      activeBranchId: ctx.activeBranchId,
      activeRole: ctx.activeRole,
    };
  }

  private sanitizeAccount(account: any) {
    const { pinHash: _p, pinFailedAttempts: _f, pinLockedUntil: _l, ...safe } = account;
    return safe;
  }
}
