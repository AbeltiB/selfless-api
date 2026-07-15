import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateFormDto, UpdateFormDto, AddFieldDto, UpdateFieldDto } from './dto/form.dto.js';

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

  async findByService(serviceId: string) {
    return this.prisma.form.findMany({
      where: { serviceId, isActive: true },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
  }

  async findOne(id: string) {
    const form = await this.prisma.form.findUnique({ where: { id }, include: { fields: { orderBy: { order: 'asc' } } } });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async create(dto: CreateFormDto, scopeOrgId?: string) {
    await this.assertServiceInScope(dto.serviceId, scopeOrgId);
    return this.prisma.form.create({ data: { serviceId: dto.serviceId, name: dto.name, isActive: true } });
  }

  async addField(formId: string, dto: AddFieldDto, scopeOrgId?: string) {
    await this.assertFormInScope(formId, scopeOrgId);
    return this.prisma.formField.create({ data: { formId, ...dto, order: dto.order ?? 0, required: dto.required ?? false } as any });
  }

  async updateField(fieldId: string, dto: UpdateFieldDto, scopeOrgId?: string) {
    await this.assertFieldInScope(fieldId, scopeOrgId);
    return this.prisma.formField.update({ where: { id: fieldId }, data: dto as any });
  }

  async removeField(fieldId: string, scopeOrgId?: string) {
    await this.assertFieldInScope(fieldId, scopeOrgId);
    return this.prisma.formField.delete({ where: { id: fieldId } });
  }

  async update(id: string, dto: UpdateFormDto, scopeOrgId?: string) {
    await this.assertFormInScope(id, scopeOrgId);
    return this.prisma.form.update({ where: { id }, data: dto });
  }

  private async assertServiceInScope(serviceId: string, scopeOrgId?: string) {
    if (!scopeOrgId) return;
    const service = await this.prisma.service.findUnique({ where: { id: serviceId }, include: { branch: true } });
    if (!service || service.branch.organizationId !== scopeOrgId) throw new ForbiddenException('That service does not belong to your organization.');
  }

  private async assertFormInScope(formId: string, scopeOrgId?: string) {
    if (!scopeOrgId) return;
    const form = await this.prisma.form.findUnique({ where: { id: formId }, include: { service: { include: { branch: true } } } });
    if (!form || form.service.branch.organizationId !== scopeOrgId) throw new NotFoundException('Form not found');
  }

  private async assertFieldInScope(fieldId: string, scopeOrgId?: string) {
    if (!scopeOrgId) return;
    const field = await this.prisma.formField.findUnique({ where: { id: fieldId }, include: { form: { include: { service: { include: { branch: true } } } } } });
    if (!field || field.form.service.branch.organizationId !== scopeOrgId) throw new NotFoundException('Field not found');
  }
}
