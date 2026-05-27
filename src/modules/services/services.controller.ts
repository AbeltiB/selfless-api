import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('services')
export class ServicesController {
  constructor(private svc: ServicesService) {}

  @Get()
  findAll(@Query() q: any) { return this.svc.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  create(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
