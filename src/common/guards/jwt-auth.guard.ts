import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { IS_SERVICE_AUTH_KEY } from '../decorators/service-auth.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // @ServiceAuth() routes are authenticated by ServiceAuthGuard's shared-secret check
    // instead, not an account JWT.
    const isServiceAuth = this.reflector.getAllAndOverride<boolean>(IS_SERVICE_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isServiceAuth) return true;

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) throw err || new UnauthorizedException('Invalid or missing token');
    return user;
  }
}
