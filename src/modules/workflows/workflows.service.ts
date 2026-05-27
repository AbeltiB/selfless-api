import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.workflow.findMany({
      where: { organizationId },
      include: {
        steps: { orderBy: { order: 'asc' }, include: { counterGroup: { select: { id: true, name: true } } } },
        _count: { select: { services: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const wf = await this.prisma.workflow.findUnique({
      where: { id },
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

  async create(dto: { organizationId: string; name: string; description?: string }) {
    return this.prisma.workflow.create({ data: { ...dto, isActive: true } });
  }

  async update(id: string, dto: { name?: string; description?: string; isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.workflow.update({ where: { id }, data: dto });
  }

  // ── Steps ──────────────────────────────────────────────────────────────

  async addStep(workflowId: string, dto: {
    name: string; stepType: string; order: number; slaMinutes?: number;
    counterGroupId?: string; isInitial?: boolean; isFinal?: boolean;
  }) {
    await this.findOne(workflowId);
    if (dto.isInitial) {
      const existingInitial = await this.prisma.workflowStep.findFirst({ where: { workflowId, isInitial: true } });
      if (existingInitial) throw new BadRequestException('Workflow already has an initial step');
    }
    return this.prisma.workflowStep.create({ data: { workflowId, ...dto } as any });
  }

  async updateStep(stepId: string, dto: { name?: string; stepType?: string; order?: number; slaMinutes?: number; counterGroupId?: string; isInitial?: boolean; isFinal?: boolean }) {
    return this.prisma.workflowStep.update({ where: { id: stepId }, data: dto as any });
  }

  async deleteStep(stepId: string) {
    await this.prisma.workflowTransition.deleteMany({ where: { OR: [{ sourceStepId: stepId }, { destinationStepId: stepId }] } });
    return this.prisma.workflowStep.delete({ where: { id: stepId } });
  }

  // ── Transitions ────────────────────────────────────────────────────────

  async addTransition(workflowId: string, dto: {
    sourceStepId: string; destinationStepId: string; label?: string; condition?: any; order?: number;
  }) {
    return this.prisma.workflowTransition.create({ data: { workflowId, ...dto, order: dto.order ?? 0 } });
  }

  async deleteTransition(id: string) {
    return this.prisma.workflowTransition.delete({ where: { id } });
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
        case 'lt': return Number(val) < Number(cond.value);
        case 'lte': return Number(val) <= Number(cond.value);
        default: return true;
      }
    });
  }
}
