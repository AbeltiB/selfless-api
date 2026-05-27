import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole, type TelegramAuthData } from 'selfless-sdk';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ── Staff / Admin (email + password) ─────────────────────────────────────

  async validateStaff(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !user.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return user;
  }

  async loginStaff(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
      branchId: user.branchId ?? undefined,
      type: 'staff',
    };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(
        { sub: user.id, type: 'staff-refresh' },
        { secret: process.env.JWT_REFRESH_SECRET || 'refresh-dev-secret', expiresIn: '7d' },
      ),
      user: this.sanitizeUser(user),
    };
  }

  async refreshStaff(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-dev-secret',
      });
      if (payload.type !== 'staff-refresh') throw new UnauthorizedException();
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException();
      const newPayload = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId, branchId: user.branchId, type: 'staff' };
      return { accessToken: this.jwtService.sign(newPayload, { expiresIn: '15m' }) };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        organization: { select: { id: true, name: true, code: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitizeUser(user);
  }

  // ── Unified Telegram login (staff takes priority over customer) ──────────

  async loginViaTelegram(data: TelegramAuthData): Promise<
    { accountType: 'staff'; tokens: Awaited<ReturnType<AuthService['loginStaff']>>; user: any } |
    { accountType: 'customer'; tokens: Awaited<ReturnType<AuthService['loginCustomer']>>; customer: any }
  > {
    const telegramId = String(data.id);

    // Check User (staff) table first
    const staffUser = await this.prisma.user.findFirst({ where: { telegramId } });
    if (staffUser) {
      await this.prisma.user.update({
        where: { id: staffUser.id },
        data: { telegramUsername: data.username ?? null, lastLoginAt: new Date() },
      });
      const tokens = await this.loginStaff(staffUser);
      return { accountType: 'staff', tokens, user: tokens.user };
    }

    // Fall through to customer
    const customer = await this.findOrCreateCustomer(data);
    const tokens = await this.loginCustomer(customer);
    return { accountType: 'customer', tokens, customer };
  }

  async linkEmail(userId: string, email: string, password: string) {
    const existing = await this.prisma.user.findFirst({ where: { email, id: { not: userId } } });
    if (existing) throw new Error('Email already in use');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { email, passwordHash },
    });
    return this.sanitizeUser(user);
  }

  async linkTelegram(userId: string, telegramData: TelegramAuthData) {
    const telegramId = String(telegramData.id);
    const existing = await this.prisma.user.findFirst({ where: { telegramId, id: { not: userId } } });
    if (existing) throw new Error('Telegram account already linked to another user');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { telegramId, telegramUsername: telegramData.username ?? null },
    });
    return this.sanitizeUser(user);
  }

  // ── Customer (Telegram) ───────────────────────────────────────────────────

  async findOrCreateCustomer(data: TelegramAuthData) {
    const existing = await this.prisma.customer.findUnique({ where: { telegramId: String(data.id) } });
    if (existing) {
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: { telegramUsername: data.username ?? null, photoUrl: data.photo_url ?? null },
      });
    }
    return this.prisma.customer.create({
      data: {
        telegramId: String(data.id),
        telegramUsername: data.username ?? null,
        firstName: data.first_name,
        lastName: data.last_name ?? null,
        photoUrl: data.photo_url ?? null,
        profileComplete: false,
      },
    });
  }

  async loginCustomer(customer: any) {
    const payload = { sub: customer.id, telegramId: customer.telegramId, type: 'customer' };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(
        { sub: customer.id, type: 'customer-refresh' },
        { secret: process.env.JWT_REFRESH_SECRET || 'refresh-dev-secret', expiresIn: '30d' },
      ),
      customer,
      profileCompletion: { phoneRequired: !customer.phone, emailRequired: false },
    };
  }

  async refreshCustomer(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-dev-secret',
      });
      if (payload.type !== 'customer-refresh') throw new UnauthorizedException();
      const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } });
      if (!customer) throw new UnauthorizedException();
      return { accessToken: this.jwtService.sign({ sub: customer.id, telegramId: customer.telegramId, type: 'customer' }, { expiresIn: '15m' }) };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ── Seed ──────────────────────────────────────────────────────────────────

  async seedAdmin() {
    const count = await this.prisma.user.count({ where: { role: UserRole.SUPER_ADMIN } });
    if (count > 0) return;
    const hash = await bcrypt.hash('Admin@123', 12);
    await this.prisma.user.create({
      data: { email: 'admin@selfless.io', passwordHash: hash, name: 'System Admin', role: UserRole.SUPER_ADMIN },
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}
