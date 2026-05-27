import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from 'selfless-sdk';

@Controller('workflows')
export class WorkflowsController {
  constructor(private svc: WorkflowsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  findAll(@Query('organizationId') orgId: string) { return this.svc.findAll(orgId); }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER)
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  create(@Body() body: any) { return this.svc.create(body); }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  // Steps
  @Post(':id/steps')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  addStep(@Param('id') id: string, @Body() body: any) { return this.svc.addStep(id, body); }

  @Patch(':id/steps/:stepId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  updateStep(@Param('stepId') stepId: string, @Body() body: any) { return this.svc.updateStep(stepId, body); }

  @Delete(':id/steps/:stepId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  deleteStep(@Param('stepId') stepId: string) { return this.svc.deleteStep(stepId); }

  // Transitions
  @Post(':id/transitions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  addTransition(@Param('id') id: string, @Body() body: any) { return this.svc.addTransition(id, body); }

  @Delete(':id/transitions/:transId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  deleteTransition(@Param('transId') transId: string) { return this.svc.deleteTransition(transId); }
}
