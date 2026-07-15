import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { BranchesService } from './branches.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ActiveOrg } from '../../common/decorators/active-org.decorator.js';
import { UserRole } from 'selfless-sdk';
import { CreateBranchDto } from './dto/create-branch.dto.js';
import { UpdateBranchDto } from './dto/update-branch.dto.js';

const ANY_STAFF = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];

@Controller('branches')
export class BranchesController {
  constructor(private svc: BranchesService) {}

  /** SUPER_ADMIN may browse all orgs (optionally filtered by query) or a specific one; everyone else is locked to their active org. */
  private scopeFor(user: any, queryOrgId?: string): string | undefined {
    if (user.activeRole === UserRole.SUPER_ADMIN) return queryOrgId;
    return user.activeOrgId;
  }

  @Get()
  @Roles(...ANY_STAFF)
  findAll(@Query('organizationId') orgId: string | undefined, @CurrentUser() user: any) {
    return this.svc.findAll(this.scopeFor(user, orgId));
  }

  @Get(':id')
  @Roles(...ANY_STAFF)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOne(id, this.scopeFor(user));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  create(@Body() dto: CreateBranchDto, @ActiveOrg() organizationId: string) {
    return this.svc.create(organizationId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, this.scopeFor(user));
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(id, this.scopeFor(user));
  }
}
