import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

/** Pulls the caller's currently-selected organization off the JWT — never trust a client-supplied organizationId instead. */
export const ActiveOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const user = (request as any).user;
  if (!user?.activeOrgId) {
    throw new ForbiddenException('No active organization selected for this account.');
  }
  return user.activeOrgId;
});

/** Same as ActiveOrg but optional — some routes (SUPER_ADMIN-wide, or org-level roles) may have no branch context. */
export const ActiveBranch = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const user = (request as any).user;
  return user?.activeBranchId;
});
