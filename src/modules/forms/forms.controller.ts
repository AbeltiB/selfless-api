import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { FormsService } from './forms.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from 'selfless-sdk';
import { CreateFormDto, UpdateFormDto, AddFieldDto, UpdateFieldDto } from './dto/form.dto.js';

const ANY_STAFF = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR, UserRole.OFFICER];
const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER];

@Controller('forms')
export class FormsController {
  constructor(private svc: FormsService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get()
  @Roles(...ANY_STAFF)
  findByService(@Query('serviceId') serviceId: string) {
    return this.svc.findByService(serviceId);
  }

  @Get(':id')
  @Roles(...ANY_STAFF)
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(...MANAGERS)
  create(@Body() dto: CreateFormDto, @CurrentUser() user: any) {
    return this.svc.create(dto, this.scopeFor(user));
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  update(@Param('id') id: string, @Body() dto: UpdateFormDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, this.scopeFor(user));
  }

  @Post(':id/fields')
  @Roles(...MANAGERS)
  addField(@Param('id') formId: string, @Body() dto: AddFieldDto, @CurrentUser() user: any) {
    return this.svc.addField(formId, dto, this.scopeFor(user));
  }

  @Patch('fields/:fieldId')
  @Roles(...MANAGERS)
  updateField(@Param('fieldId') fieldId: string, @Body() dto: UpdateFieldDto, @CurrentUser() user: any) {
    return this.svc.updateField(fieldId, dto, this.scopeFor(user));
  }

  @Delete('fields/:fieldId')
  @Roles(...MANAGERS)
  removeField(@Param('fieldId') fieldId: string, @CurrentUser() user: any) {
    return this.svc.removeField(fieldId, this.scopeFor(user));
  }
}
