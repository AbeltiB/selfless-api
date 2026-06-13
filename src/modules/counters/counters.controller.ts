import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { CountersService } from './counters.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('counters')
export class CountersController {
  constructor(private svc: CountersService) {}

  @Get('groups')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  findGroups(@Query('organizationId') orgId: string) { return this.svc.findAllGroups(orgId); }

  @Post('groups')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  createGroup(@Body() body: any) { return this.svc.createGroup(body); }

  @Patch('groups/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  updateGroup(@Param('id') id: string, @Body() body: any) { return this.svc.updateGroup(id, body); }

  @Get('display')
  @Public()
  getDisplay(@Query('branchId') branchId: string) { return this.svc.getDisplayBoard(branchId); }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER)
  findAll(@Query('branchId') branchId: string) { return this.svc.findAllByBranch(branchId); }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  create(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }
}
