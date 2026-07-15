import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { requireEnv } from '../../common/utils/require-env.util.js';

interface JwtAccessPayload {
  sub: string;
  phone: string;
  activeOrgId?: string;
  activeBranchId?: string;
  activeRole?: string;
  deviceId?: string;
  type: 'account';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireEnv('JWT_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload) {
    const account = await this.prisma.account.findUnique({ where: { id: payload.sub } });
    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account not found or inactive');
    }

    return {
      ...account,
      activeOrgId: payload.activeOrgId,
      activeBranchId: payload.activeBranchId,
      activeRole: payload.activeRole,
      deviceId: payload.deviceId,
      type: 'account' as const,
    };
  }
}
