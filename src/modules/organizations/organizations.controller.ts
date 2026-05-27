import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('organizations')
export class OrganizationsController {
  constructor(private svc: OrganizationsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }
}
