import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { CountersService } from './counters.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ActiveOrg } from '../../common/decorators/active-org.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { UserRole } from 'selfless-sdk';
import { CreateCounterGroupDto, UpdateCounterGroupDto, CreateCounterDto, UpdateCounterDto } from './dto/counter.dto.js';

const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER];
const ANY_STAFF = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];

@Controller('counters')
export class CountersController {
  constructor(private svc: CountersService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get('groups')
  @Roles(...MANAGERS)
  findGroups(@ActiveOrg() organizationId: string) {
    return this.svc.findAllGroups(organizationId);
  }

  @Post('groups')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  createGroup(@Body() dto: CreateCounterGroupDto, @ActiveOrg() organizationId: string) {
    return this.svc.createGroup(organizationId, dto);
  }

  @Patch('groups/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  updateGroup(@Param('id') id: string, @Body() dto: UpdateCounterGroupDto, @CurrentUser() user: any) {
    return this.svc.updateGroup(id, dto, this.scopeFor(user));
  }

  @Get('display')
  @Public()
  getDisplay(@Query('branchId') branchId: string) {
    return this.svc.getDisplayBoard(branchId);
  }

  @Get()
  @Roles(...ANY_STAFF)
  findAll(@Query('branchId') branchId: string, @CurrentUser() user: any) {
    return this.svc.findAllByBranch(branchId, this.scopeFor(user));
  }

  @Post()
  @Roles(...MANAGERS)
  create(@Body() dto: CreateCounterDto, @CurrentUser() user: any) {
    return this.svc.create(dto, this.scopeFor(user));
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  update(@Param('id') id: string, @Body() dto: UpdateCounterDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, this.scopeFor(user));
  }
}
