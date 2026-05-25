import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('users')
@Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async findAll(@Query('branchId') branchId?: string) {
    return { success: true, data: await this.usersService.findAll(branchId) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.usersService.findOne(id) };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() body: any) {
    return { success: true, data: await this.usersService.create(body) };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return { success: true, data: await this.usersService.update(id, body) };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
