import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

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

  async create(serviceId: string, dto: { name: string }) {
    return this.prisma.form.create({ data: { serviceId, name: dto.name, isActive: true } });
  }

  async addField(formId: string, dto: { label: string; fieldKey: string; fieldType: string; required?: boolean; options?: any; conditions?: any; order?: number }) {
    await this.findOne(formId);
    return this.prisma.formField.create({ data: { formId, ...dto, order: dto.order ?? 0, required: dto.required ?? false } as any });
  }

  async updateField(fieldId: string, dto: any) {
    return this.prisma.formField.update({ where: { id: fieldId }, data: dto });
  }

  async removeField(fieldId: string) {
    return this.prisma.formField.delete({ where: { id: fieldId } });
  }

  async update(id: string, dto: { name?: string; isActive?: boolean }) {
    return this.prisma.form.update({ where: { id }, data: dto });
  }
}
