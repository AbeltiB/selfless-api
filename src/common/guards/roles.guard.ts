import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'selfless-sdk';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_ANY_ACCOUNT_KEY } from '../decorators/any-account.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    const isAnyAccount = this.reflector.getAllAndOverride<boolean>(IS_ANY_ACCOUNT_KEY, [context.getHandler(), context.getClass()]);

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // SUPER_ADMIN is a global role — bypasses per-route role checks everywhere.
    if (user.activeRole === UserRole.SUPER_ADMIN) return true;

    if (requiredRoles && requiredRoles.length > 0) {
      if (!user.activeRole || !requiredRoles.includes(user.activeRole)) {
        throw new ForbiddenException(`Requires one of: ${requiredRoles.join(', ')}`);
      }
      return true;
    }

    if (isAnyAccount) return true;

    // No @Public(), @Roles(), or @AnyAccount() — this is a gap, not an intentional open route. Fail loud.
    throw new ForbiddenException('This route has no access policy configured.');
  }
}
