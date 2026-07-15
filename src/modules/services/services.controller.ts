import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from 'selfless-sdk';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

const ANY_STAFF = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];

@Controller('services')
export class ServicesController {
  constructor(private svc: ServicesService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get()
  @Roles(...ANY_STAFF)
  findAll(@Query('branchId') branchId: string | undefined, @CurrentUser() user: any) {
    return this.svc.findAll({ branchId }, this.scopeFor(user));
  }

  @Get(':id')
  @Roles(...ANY_STAFF)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOne(id, this.scopeFor(user));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: any) {
    return this.svc.create(dto, this.scopeFor(user));
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, this.scopeFor(user));
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(id, this.scopeFor(user));
  }
}
