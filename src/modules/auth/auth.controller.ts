import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AnyAccount } from '../../common/decorators/any-account.decorator.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { SetPinDto } from './dto/set-pin.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPinDto } from './dto/reset-pin.dto.js';
import { SwitchOrgDto } from './dto/switch-org.dto.js';
import { LogoutDto } from './dto/logout.dto.js';

const REFRESH_COOKIE = 'refreshToken';
const DEVICE_COOKIE = 'selfless_device';
const COOKIE_PATH = '/api/v1/auth';

function cookieOpts(secure: boolean, maxAgeMs: number) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: COOKIE_PATH, maxAge: maxAgeMs };
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  private isProd() {
    return process.env.NODE_ENV === 'production';
  }

  private setSessionCookies(res: Response, refreshToken: string, deviceToken?: string) {
    (res as any).cookie(REFRESH_COOKIE, refreshToken, cookieOpts(this.isProd(), 10 * 24 * 60 * 60 * 1000));
    if (deviceToken) {
      (res as any).cookie(DEVICE_COOKIE, deviceToken, cookieOpts(this.isProd(), 60 * 24 * 60 * 60 * 1000));
    }
  }

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    const data = await this.auth.requestOtp(dto.phone, dto.purpose, req.ip);
    return { success: true, data };
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const data = await this.auth.verifyOtp(dto.phone, dto.purpose, dto.code);
    return { success: true, data };
  }

  @Public()
  @Post('set-pin')
  @HttpCode(HttpStatus.OK)
  async setPin(@Body() dto: SetPinDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, deviceToken, account, activeOrgId, activeBranchId, activeRole } = await this.auth.setPin(
      dto.otpToken,
      dto.pin,
      dto.firstName,
      dto.lastName,
      dto.email,
      { userAgent: req.headers['user-agent'], ip: req.ip },
    );
    this.setSessionCookies(res, refreshToken, deviceToken);
    return { success: true, data: { accessToken, account, activeOrgId, activeBranchId, activeRole, deviceTrusted: true } };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawDeviceToken = (req as any).cookies?.[DEVICE_COOKIE];
    const result = await this.auth.login(dto.phone, dto.pin, dto.otpToken, rawDeviceToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    if (result.otpRequired) {
      return { success: true, data: { otpRequired: true, purpose: result.purpose } };
    }

    const { accessToken, refreshToken, deviceToken, account, activeOrgId, activeBranchId, activeRole } = result as any;
    this.setSessionCookies(res, refreshToken, deviceToken);
    return { success: true, data: { accessToken, account, activeOrgId, activeBranchId, activeRole, otpRequired: false } };
  }

  @Public()
  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  async resetPin(@Body() dto: ResetPinDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, deviceToken, account, activeOrgId, activeBranchId, activeRole } = await this.auth.resetPin(dto.otpToken, dto.newPin, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setSessionCookies(res, refreshToken, deviceToken);
    return { success: true, data: { accessToken, account, activeOrgId, activeBranchId, activeRole } };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Body() body: { refreshToken?: string }) {
    const token = (req as any).cookies?.[REFRESH_COOKIE] || body.refreshToken;
    if (!token) return { success: false, message: 'No refresh token' };
    const data = await this.auth.refresh(token);
    return { success: true, data };
  }

  @AnyAccount()
  @Post('switch-org')
  @HttpCode(HttpStatus.OK)
  async switchOrg(@Body() dto: SwitchOrgDto, @CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, activeOrgId, activeBranchId, activeRole } = await this.auth.switchOrg(user.id, dto.organizationId, user.deviceId);
    this.setSessionCookies(res, refreshToken);
    return { success: true, data: { accessToken, activeOrgId, activeBranchId, activeRole } };
  }

  @AnyAccount()
  @Get('me')
  async me(@CurrentUser() user: any) {
    return { success: true, data: await this.auth.getMe(user.id) };
  }

  @AnyAccount()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto, @CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.deviceId, !!dto.revokeDevice);
    (res as any).clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    if (dto.revokeDevice) (res as any).clearCookie(DEVICE_COOKIE, { path: COOKIE_PATH });
    return { success: true };
  }
}
