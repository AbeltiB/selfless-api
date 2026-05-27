import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { BranchesService } from './branches.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('branches')
export class BranchesController {
  constructor(private svc: BranchesService) {}

  @Get()
  findAll(@Query('organizationId') orgId?: string) { return this.svc.findAll(orgId); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  create(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
