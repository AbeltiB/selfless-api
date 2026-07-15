import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateRequirementDto, UpdateRequirementDto } from './dto/requirement.dto.js';

@Injectable()
export class RequirementsService {
  constructor(private prisma: PrismaService) {}

  async findByService(serviceId: string) {
    return this.prisma.requirement.findMany({ where: { serviceId }, orderBy: { order: 'asc' } });
  }

  async create(dto: CreateRequirementDto, scopeOrgId?: string) {
    await this.assertServiceInScope(dto.serviceId, scopeOrgId);
    const { serviceId, ...rest } = dto;
    return this.prisma.requirement.create({ data: { serviceId, ...rest, required: dto.required ?? true, order: dto.order ?? 0 } as any });
  }

  async update(id: string, dto: UpdateRequirementDto, scopeOrgId?: string) {
    await this.assertRequirementInScope(id, scopeOrgId);
    return this.prisma.requirement.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, scopeOrgId?: string) {
    await this.assertRequirementInScope(id, scopeOrgId);
    return this.prisma.requirement.delete({ where: { id } });
  }

  private async assertServiceInScope(serviceId: string, scopeOrgId?: string) {
    if (!scopeOrgId) return;
    const service = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { branch: true } });
    if (!service || service.branch.organizationId !== scopeOrgId) throw new ForbiddenException('That service does not belong to your organization.');
  }

  private async assertRequirementInScope(id: string, scopeOrgId?: string) {
    if (!scopeOrgId) return;
    const req = await this.prisma.requirement.findUnique({ where: { id }, include: { service: { include: { branch: true } } } });
    if (!req || req.service.branch.organizationId !== scopeOrgId) throw new NotFoundException('Requirement not found');
  }
}
