import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: any) {
    if (payload.type === 'customer') {
      const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } });
      if (!customer) throw new UnauthorizedException('Customer not found');
      return { ...customer, type: 'customer' };
    }

    // staff / admin
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, branchId: true, organizationId: true, isActive: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');
    return { ...user, type: 'staff' };
  }
}
