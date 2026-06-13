import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { FormsService } from './forms.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('forms')
export class FormsController {
  constructor(private svc: FormsService) {}

  @Get()
  findByService(@Query('serviceId') serviceId: string) {
    return this.svc.findByService(serviceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  create(@Body() body: { serviceId: string; name: string }) {
    return this.svc.create(body.serviceId, { name: body.name });
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  update(@Param('id') id: string, @Body() body: { name?: string; isActive?: boolean }) {
    return this.svc.update(id, body);
  }

  @Post(':id/fields')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  addField(
    @Param('id') formId: string,
    @Body() body: { label: string; fieldKey: string; fieldType: string; required?: boolean; options?: any; conditions?: any; order?: number },
  ) {
    return this.svc.addField(formId, body);
  }

  @Patch('fields/:fieldId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  updateField(@Param('fieldId') fieldId: string, @Body() body: any) {
    return this.svc.updateField(fieldId, body);
  }

  @Delete('fields/:fieldId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  removeField(@Param('fieldId') fieldId: string) {
    return this.svc.removeField(fieldId);
  }
}
