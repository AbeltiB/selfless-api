import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { QueueStatus } from 'selfless-sdk';

export class OpenQueueDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsUUID()
  stepId?: string;
}

export class UpdateQueueStatusDto {
  @IsEnum(QueueStatus)
  status!: QueueStatus;
}

export class CallNextDto {
  @IsOptional()
  @IsUUID()
  counterId?: string;
}
