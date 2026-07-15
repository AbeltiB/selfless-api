import { IsString, IsOptional, IsInt, IsEnum, MinLength, IsUUID } from 'class-validator';
import { ServiceType } from 'selfless-sdk';

export class CreateServiceDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  estimatedDuration?: number;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}
