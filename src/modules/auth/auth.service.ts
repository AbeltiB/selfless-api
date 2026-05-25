import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole } from 'selfless-sdk';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { secret: process.env.JWT_REFRESH_SECRET || 'refresh-dev-secret', expiresIn: '7d' },
    );
    return { accessToken, refreshToken, user: this.sanitizeUser(user) };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-dev-secret',
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException();
      const newPayload = { sub: user.id, email: user.email, role: user.role };
      return { accessToken: this.jwtService.sign(newPayload, { expiresIn: '15m' }) };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitizeUser(user);
  }

  async seedAdmin() {
    const count = await this.prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (count > 0) return;
    const hash = await bcrypt.hash('Admin@123', 12);
    await this.prisma.user.create({
      data: {
        email: 'admin@selfless.io',
        passwordHash: hash,
        name: 'System Admin',
        role: UserRole.ADMIN,
      },
    });
    console.log('Seeded default admin: admin@selfless.io / Admin@123');
  }

  private sanitizeUser(user: any) {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}
