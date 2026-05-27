import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import type { Request } from 'express';
import { verifyTelegramAuth, type TelegramAuthData } from 'selfless-sdk';
import { AuthService } from './auth.service.js';

@Injectable()
export class TelegramStrategy extends PassportStrategy(Strategy, 'telegram') {
  constructor(private auth: AuthService) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const data = req.body as TelegramAuthData;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new UnauthorizedException('Telegram bot not configured');

    if (!verifyTelegramAuth(data, token)) {
      throw new UnauthorizedException('Invalid Telegram auth data');
    }
    return this.auth.loginViaTelegram(data);
  }
}
