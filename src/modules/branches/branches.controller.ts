import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { BranchesService } from './branches.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('branches')
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get()
  async findAll() {
    return { success: true, data: await this.branchesService.findAll() };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.branchesService.findOne(id) };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() body: any) {
    return { success: true, data: await this.branchesService.create(body) };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BRANCH_MANAGER)
  async update(@Param('id') id: string, @Body() body: any) {
    return { success: true, data: await this.branchesService.update(id, body) };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }
}
