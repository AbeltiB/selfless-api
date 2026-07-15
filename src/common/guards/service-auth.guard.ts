import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_SERVICE_AUTH_KEY } from '../decorators/service-auth.decorator.js';
import { requireEnv } from '../utils/require-env.util.js';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isServiceAuth = this.reflector.getAllAndOverride<boolean>(IS_SERVICE_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isServiceAuth) return true;

    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-service-token'];
    if (!token || token !== requireEnv('WORKER_SERVICE_TOKEN')) {
      throw new UnauthorizedException('Invalid or missing service token');
    }
    return true;
  }
}
