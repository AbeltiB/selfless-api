import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './jwt.strategy.js';
import { OtpService } from './otp.service.js';
import { PinService } from './pin.service.js';
import { DeviceTrustService } from './device-trust.service.js';
import { OTP_PROVIDER } from './otp-provider.interface.js';
import { DevConsoleOtpProvider } from './otp-provider.dev.js';
import { requireEnv } from '../../common/utils/require-env.util.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: requireEnv('JWT_SECRET'),
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    OtpService,
    PinService,
    DeviceTrustService,
    // Real HTTP gateway is a follow-up: swap this binding once the provider details are wired in.
    { provide: OTP_PROVIDER, useClass: DevConsoleOtpProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
