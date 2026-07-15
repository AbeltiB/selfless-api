import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PriorityFlagsService } from './priority-flags.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ActiveOrg } from '../../common/decorators/active-org.decorator.js';
import { UserRole } from 'selfless-sdk';
import { CreatePriorityFlagDto, UpdatePriorityFlagDto, AssignPriorityFlagDto } from './dto/priority-flag.dto.js';

const READERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];
const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER];

@Controller('priority-flags')
export class PriorityFlagsController {
  constructor(private svc: PriorityFlagsService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get()
  @Roles(...READERS)
  findAll(@ActiveOrg() organizationId: string) {
    return this.svc.findAll(organizationId);
  }

  @Post()
  @Roles(...MANAGERS)
  create(@Body() dto: CreatePriorityFlagDto, @ActiveOrg() organizationId: string) {
    return this.svc.create(organizationId, dto);
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  update(@Param('id') id: string, @Body() dto: UpdatePriorityFlagDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, this.scopeFor(user));
  }

  @Delete(':id')
  @Roles(...MANAGERS)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(id, this.scopeFor(user));
  }

  @Post(':id/assign')
  @Roles(...READERS)
  assign(@Param('id') id: string, @Body() dto: AssignPriorityFlagDto, @CurrentUser() user: any) {
    return this.svc.assign(id, dto, user.id, this.scopeFor(user));
  }

  @Delete(':id/assign/:accountId')
  @Roles(...READERS)
  unassign(@Param('id') id: string, @Param('accountId') accountId: string, @CurrentUser() user: any) {
    return this.svc.unassign(id, accountId, this.scopeFor(user));
  }
}
