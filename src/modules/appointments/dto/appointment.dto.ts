import { IsString, IsOptional, IsUUID, IsInt, IsISO8601, IsEnum } from 'class-validator';
import { AppointmentStatus } from 'selfless-sdk';

export class CreateAppointmentDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}
