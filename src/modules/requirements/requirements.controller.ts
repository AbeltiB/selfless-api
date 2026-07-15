import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { RequirementsService } from './requirements.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from 'selfless-sdk';
import { CreateRequirementDto, UpdateRequirementDto } from './dto/requirement.dto.js';

const ANY_STAFF = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];
const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER];

@Controller('requirements')
export class RequirementsController {
  constructor(private svc: RequirementsService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get()
  @Roles(...ANY_STAFF)
  findByService(@Query('serviceId') serviceId: string) {
    return this.svc.findByService(serviceId);
  }

  @Post()
  @Roles(...MANAGERS)
  create(@Body() dto: CreateRequirementDto, @CurrentUser() user: any) {
    return this.svc.create(dto, this.scopeFor(user));
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  update(@Param('id') id: string, @Body() dto: UpdateRequirementDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, this.scopeFor(user));
  }

  @Delete(':id')
  @Roles(...MANAGERS)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.remove(id, this.scopeFor(user));
  }
}
