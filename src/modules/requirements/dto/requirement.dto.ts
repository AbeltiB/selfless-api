import { IsString, IsOptional, IsBoolean, IsInt, IsUUID, IsEnum, IsObject, MinLength } from 'class-validator';
import { RequirementType } from 'selfless-sdk';

export class CreateRequirementDto {
  @IsUUID()
  serviceId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(RequirementType)
  type!: RequirementType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateRequirementDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  order?: number;
}
