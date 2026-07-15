import { IsString, IsOptional, IsInt, IsEnum, IsBoolean, IsUUID } from 'class-validator';
import { ServiceType } from 'selfless-sdk';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}
