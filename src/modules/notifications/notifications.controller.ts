import { Controller, Get, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR)
  async findAll(
    @CurrentUser() user: any,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const skip = parseInt(offset ?? '0', 10) || 0;
    return this.notifications.findAll(this.scopeFor(user), { channel, status, take, skip });
  }
}
