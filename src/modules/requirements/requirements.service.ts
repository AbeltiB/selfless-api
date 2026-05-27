import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RequirementsService {
  constructor(private prisma: PrismaService) {}

  async findByService(serviceId: string) {
    return this.prisma.requirement.findMany({ where: { serviceId }, orderBy: { order: 'asc' } });
  }

  async create(serviceId: string, dto: { name: string; type: string; required?: boolean; validationRules?: any; order?: number }) {
    return this.prisma.requirement.create({ data: { serviceId, ...dto, required: dto.required ?? true, order: dto.order ?? 0 } as any });
  }

  async update(id: string, dto: { name?: string; required?: boolean; validationRules?: any; order?: number }) {
    return this.prisma.requirement.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.requirement.delete({ where: { id } });
  }
}
