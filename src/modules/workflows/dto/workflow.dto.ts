import { IsString, IsOptional, IsInt, IsBoolean, IsUUID, IsEnum, IsIn, ValidateNested, IsObject, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { StepType } from 'selfless-sdk';

export class CreateWorkflowDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddStepDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(StepType)
  stepType!: StepType;

  @IsInt()
  order!: number;

  @IsOptional()
  @IsInt()
  slaMinutes?: number;

  @IsOptional()
  @IsUUID()
  counterGroupId?: string;

  @IsOptional()
  @IsBoolean()
  isInitial?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}

export class UpdateStepDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(StepType)
  stepType?: StepType;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsInt()
  slaMinutes?: number;

  @IsOptional()
  @IsUUID()
  counterGroupId?: string;

  @IsOptional()
  @IsBoolean()
  isInitial?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}

class ConditionDto {
  @IsString()
  field!: string;

  @IsIn(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in'])
  operator!: string;

  value: unknown;
}

export class AddTransitionDto {
  @IsUUID()
  sourceStepId!: string;

  @IsUUID()
  destinationStepId!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ConditionDto)
  condition?: ConditionDto;
}
