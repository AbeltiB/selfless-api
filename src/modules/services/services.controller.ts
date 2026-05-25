import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Get()
  async findAll(@Query('branchId') branchId?: string) {
    return { success: true, data: await this.servicesService.findAll(branchId) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.servicesService.findOne(id) };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER)
  async create(@Body() body: any) {
    return { success: true, data: await this.servicesService.create(body) };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER)
  async update(@Param('id') id: string, @Body() body: any) {
    return { success: true, data: await this.servicesService.update(id, body) };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
