import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('users')
@Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async findAll(@Query('branchId') branchId?: string, @Query('organizationId') organizationId?: string) {
    return { success: true, data: await this.usersService.findAll({ branchId, organizationId }) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.usersService.findOne(id) };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  async create(@Body() body: any) {
    return { success: true, data: await this.usersService.create(body) };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return { success: true, data: await this.usersService.update(id, body) };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
