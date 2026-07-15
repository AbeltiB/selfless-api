import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ActiveOrg } from '../../common/decorators/active-org.decorator.js';
import { UserRole } from 'selfless-sdk';
import { CreateWorkflowDto, UpdateWorkflowDto, AddStepDto, UpdateStepDto, AddTransitionDto } from './dto/workflow.dto.js';

const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER];
const ADMINS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

@Controller('workflows')
export class WorkflowsController {
  constructor(private svc: WorkflowsService) {}

  private scopeFor(user: any): string | undefined {
    return user.activeRole === UserRole.SUPER_ADMIN ? undefined : user.activeOrgId;
  }

  @Get()
  @Roles(...MANAGERS)
  findAll(@ActiveOrg() organizationId: string) {
    return this.svc.findAll(organizationId);
  }

  @Get(':id')
  @Roles(...MANAGERS)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findOne(id, this.scopeFor(user));
  }

  @Post()
  @Roles(...ADMINS)
  create(@Body() dto: CreateWorkflowDto, @ActiveOrg() organizationId: string) {
    return this.svc.create(organizationId, dto);
  }

  @Patch(':id')
  @Roles(...ADMINS)
  update(@Param('id') id: string, @Body() dto: UpdateWorkflowDto, @CurrentUser() user: any) {
    return this.svc.update(id, dto, this.scopeFor(user));
  }

  @Post(':id/steps')
  @Roles(...ADMINS)
  addStep(@Param('id') id: string, @Body() dto: AddStepDto, @CurrentUser() user: any) {
    return this.svc.addStep(id, dto, this.scopeFor(user));
  }

  @Patch(':id/steps/:stepId')
  @Roles(...ADMINS)
  updateStep(@Param('stepId') stepId: string, @Body() dto: UpdateStepDto, @CurrentUser() user: any) {
    return this.svc.updateStep(stepId, dto, this.scopeFor(user));
  }

  @Delete(':id/steps/:stepId')
  @Roles(...ADMINS)
  deleteStep(@Param('stepId') stepId: string, @CurrentUser() user: any) {
    return this.svc.deleteStep(stepId, this.scopeFor(user));
  }

  @Post(':id/transitions')
  @Roles(...ADMINS)
  addTransition(@Param('id') id: string, @Body() dto: AddTransitionDto, @CurrentUser() user: any) {
    return this.svc.addTransition(id, dto, this.scopeFor(user));
  }

  @Delete(':id/transitions/:transId')
  @Roles(...ADMINS)
  deleteTransition(@Param('transId') transId: string, @CurrentUser() user: any) {
    return this.svc.deleteTransition(transId, this.scopeFor(user));
  }
}
