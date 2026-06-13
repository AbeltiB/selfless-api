import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { RequirementsService } from './requirements.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('requirements')
export class RequirementsController {
  constructor(private svc: RequirementsService) {}

  @Get()
  findByService(@Query('serviceId') serviceId: string) {
    return this.svc.findByService(serviceId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  create(@Body() body: { serviceId: string; name: string; type: string; required?: boolean; validationRules?: any; order?: number }) {
    return this.svc.create(body.serviceId, body);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
