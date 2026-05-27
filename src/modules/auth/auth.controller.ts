import { Controller, Post, Get, Patch, Body, Req, Res, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { verifyTelegramAuth, type TelegramAuthData } from 'selfless-sdk';

const REFRESH_COOKIE_OPTS = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
});

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // ── Staff / Admin login ──────────────────────────────────────────────────

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginStaff(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.auth.loginStaff((req as any).user);
    (res as any).cookie('refreshToken', refreshToken, {
      ...REFRESH_COOKIE_OPTS(process.env.NODE_ENV === 'production'),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { success: true, data: { accessToken, user } };
  }

  // ── Unified Telegram login (staff or customer) ───────────────────────────

  @Public()
  @UseGuards(AuthGuard('telegram'))
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  async loginTelegram(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = (req as any).user as Awaited<ReturnType<AuthService['loginViaTelegram']>>;

    if (result.accountType === 'staff') {
      const { accessToken, refreshToken } = result.tokens;
      (res as any).cookie('refreshToken', refreshToken, {
        ...REFRESH_COOKIE_OPTS(process.env.NODE_ENV === 'production'),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return { success: true, data: { accountType: 'staff', accessToken, user: result.user } };
    }

    const { accessToken, refreshToken, profileCompletion } = result.tokens;
    (res as any).cookie('refreshToken', refreshToken, {
      ...REFRESH_COOKIE_OPTS(process.env.NODE_ENV === 'production'),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return { success: true, data: { accountType: 'customer', accessToken, customer: result.customer, profileCompletion } };
  }

  // ── Link email+password to staff account ────────────────────────────────

  @Patch('link-email')
  @HttpCode(HttpStatus.OK)
  async linkEmail(
    @CurrentUser() user: any,
    @Body() body: { email: string; password: string },
  ) {
    if (user.type !== 'staff') throw new BadRequestException('Staff accounts only');
    if (!body.email || !body.password) throw new BadRequestException('email and password required');
    const updated = await this.auth.linkEmail(user.sub, body.email, body.password);
    return { success: true, data: updated };
  }

  // ── Link Telegram to existing staff account ──────────────────────────────

  @Patch('link-telegram')
  @HttpCode(HttpStatus.OK)
  async linkTelegram(
    @CurrentUser() user: any,
    @Body() body: TelegramAuthData,
  ) {
    if (user.type !== 'staff') throw new BadRequestException('Staff accounts only');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new BadRequestException('Telegram not configured');
    if (!verifyTelegramAuth(body, token)) throw new BadRequestException('Invalid Telegram auth data');
    const updated = await this.auth.linkTelegram(user.sub, body);
    return { success: true, data: updated };
  }

  // ── Refresh (handles both staff and customer) ────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Body() body: any) {
    const token = (req as any).cookies?.['refreshToken'] || body.refreshToken;
    if (!token) throw new Error('No refresh token');

    try {
      const data = await this.auth.refreshStaff(token);
      return { success: true, data };
    } catch {
      const data = await this.auth.refreshCustomer(token);
      return { success: true, data };
    }
  }

  // ── Profile completion ───────────────────────────────────────────────────

  @Patch('complete-profile')
  @HttpCode(HttpStatus.OK)
  async completeProfile(@CurrentUser() user: any, @Body() body: { phone?: string; email?: string }) {
    if (!user.telegramId) throw new Error('Not a customer session');
    // Import lazily to avoid circular dep
    const { PrismaService } = await import('../../prisma/prisma.service.js');
    // For now handled via customers module — this is a convenience alias
    return { success: true, message: 'Use PATCH /customers/me to update your profile' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    (res as any).clearCookie('refreshToken', { path: '/api/v1/auth' });
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser() user: any) {
    if (user.type === 'customer' || user.telegramId) {
      return { success: true, data: { type: 'customer', ...user } };
    }
    return { success: true, data: await this.auth.getMe(user.sub) };
  }
}
