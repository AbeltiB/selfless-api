import { Controller, Get, Post, Patch, Param, Body, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from 'selfless-sdk';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private svc: OrganizationsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    this.assertOwnOrgUnlessSuperAdmin(user, id);
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: any) {
    return this.svc.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @CurrentUser() user: any) {
    this.assertOwnOrgUnlessSuperAdmin(user, id);
    // ORG_ADMIN may not change status (suspend/offboard their own org) — SUPER_ADMIN only.
    if (user.activeRole !== UserRole.SUPER_ADMIN) delete (dto as any).status;
    return this.svc.update(id, dto);
  }

  private assertOwnOrgUnlessSuperAdmin(user: any, targetOrgId: string) {
    if (user.activeRole === UserRole.SUPER_ADMIN) return;
    if (user.activeOrgId !== targetOrgId) {
      throw new ForbiddenException('You can only access your own organization.');
    }
  }
}
