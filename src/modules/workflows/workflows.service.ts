import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateWorkflowDto, UpdateWorkflowDto, AddStepDto, UpdateStepDto, AddTransitionDto } from './dto/workflow.dto.js';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async findAll(scopeOrgId: string) {
    return this.prisma.workflow.findMany({
      where: { organizationId: scopeOrgId },
      include: {
        steps: { orderBy: { order: 'asc' }, include: { counterGroup: { select: { id: true, name: true } } } },
        _count: { select: { services: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, scopeOrgId?: string) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id, ...(scopeOrgId ? { organizationId: scopeOrgId } : {}) },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            counterGroup: true,
            transitionsFrom: { include: { destinationStep: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!wf) throw new NotFoundException('Workflow not found');
    return wf;
  }

  async create(organizationId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({ data: { ...dto, organizationId, isActive: true } });
  }

  async update(id: string, dto: UpdateWorkflowDto, scopeOrgId?: string) {
    await this.findOne(id, scopeOrgId);
    return this.prisma.workflow.update({ where: { id }, data: dto });
  }

  // ── Steps ──────────────────────────────────────────────────────────────

  async addStep(workflowId: string, dto: AddStepDto, scopeOrgId?: string) {
    await this.findOne(workflowId, scopeOrgId);
    if (dto.isInitial) {
      const existingInitial = await this.prisma.workflowStep.findFirst({ where: { workflowId, isInitial: true } });
      if (existingInitial) throw new BadRequestException('Workflow already has an initial step');
    }
    return this.prisma.workflowStep.create({ data: { workflowId, ...dto } as any });
  }

  async updateStep(stepId: string, dto: UpdateStepDto, scopeOrgId?: string) {
    await this.assertStepInScope(stepId, scopeOrgId);
    return this.prisma.workflowStep.update({ where: { id: stepId }, data: dto as any });
  }

  async deleteStep(stepId: string, scopeOrgId?: string) {
    await this.assertStepInScope(stepId, scopeOrgId);
    await this.prisma.workflowTransition.deleteMany({ where: { OR: [{ sourceStepId: stepId }, { destinationStepId: stepId }] } });
    return this.prisma.workflowStep.delete({ where: { id: stepId } });
  }

  // ── Transitions ────────────────────────────────────────────────────────

  async addTransition(workflowId: string, dto: AddTransitionDto, scopeOrgId?: string) {
    await this.findOne(workflowId, scopeOrgId);
    return this.prisma.workflowTransition.create({ data: { workflowId, ...dto, order: dto.order ?? 0 } as any });
  }

  async deleteTransition(id: string, scopeOrgId?: string) {
    if (scopeOrgId) {
      const trans = await this.prisma.workflowTransition.findUnique({ where: { id }, include: { sourceStep: { include: { workflow: true } } } });
      if (!trans || trans.sourceStep.workflow.organizationId !== scopeOrgId) throw new NotFoundException('Transition not found');
    }
    return this.prisma.workflowTransition.delete({ where: { id } });
  }

  private async assertStepInScope(stepId: string, scopeOrgId?: string) {
    if (!scopeOrgId) return;
    const step = await this.prisma.workflowStep.findUnique({ where: { id: stepId }, include: { workflow: true } });
    if (!step || step.workflow.organizationId !== scopeOrgId) throw new NotFoundException('Step not found');
  }

  // ── Used by ticket engine ──────────────────────────────────────────────

  async getAvailableTransitions(currentStepId: string, formData?: Record<string, unknown>) {
    const transitions = await this.prisma.workflowTransition.findMany({
      where: { sourceStepId: currentStepId },
      include: { destinationStep: true },
      orderBy: { order: 'asc' },
    });

    if (!formData) return transitions;

    return transitions.filter((t) => {
      if (!t.condition) return true;
      const cond = t.condition as { field: string; operator: string; value: unknown };
      const val = formData[cond.field];
      switch (cond.operator) {
        case 'eq': return val === cond.value;
        case 'neq': return val !== cond.value;
        case 'gt': return Number(val) > Number(cond.value);
        case 'gte': return Number(val) >= Number(cond.value);
        case 'lt': return Number(val) <= Number(cond.value);
        case 'contains': return typeof val === 'string' && typeof cond.value === 'string' && val.includes(cond.value);
        case 'in': return Array.isArray(cond.value) && cond.value.includes(val);
        default: return true;
      }
    });
  }
}
