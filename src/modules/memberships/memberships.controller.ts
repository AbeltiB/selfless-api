import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { MembershipsService } from './memberships.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ActiveOrg } from '../../common/decorators/active-org.decorator.js';
import { UserRole } from 'selfless-sdk';
import { InviteMemberDto, UpdateMembershipDto } from './dto/membership.dto.js';

const READERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER];
const WRITERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

@Controller('memberships')
export class MembershipsController {
  constructor(private svc: MembershipsService) {}

  @Get()
  @Roles(...READERS)
  findAll(@Query('branchId') branchId: string | undefined, @ActiveOrg() organizationId: string) {
    return this.svc.findAll(organizationId, branchId);
  }

  @Post()
  @Roles(...WRITERS)
  invite(@Body() dto: InviteMemberDto, @ActiveOrg() organizationId: string, @CurrentUser() user: any) {
    return this.svc.invite(organizationId, dto, user.activeRole);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  update(@Param('id') id: string, @Body() dto: UpdateMembershipDto, @ActiveOrg() organizationId: string, @CurrentUser() user: any) {
    return this.svc.update(id, dto, organizationId, user.activeRole);
  }

  @Delete(':id')
  @Roles(...WRITERS)
  remove(@Param('id') id: string, @ActiveOrg() organizationId: string, @CurrentUser() user: any) {
    return this.svc.remove(id, organizationId, user.activeRole, user.id);
  }
}
