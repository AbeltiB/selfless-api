import { IsString, IsOptional, IsBoolean, IsInt, IsUUID, IsEnum, IsObject, MinLength } from 'class-validator';
import { FieldType } from 'selfless-sdk';

export class CreateFormDto {
  @IsUUID()
  serviceId!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateFormDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddFieldDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(1)
  fieldKey!: string;

  @IsEnum(FieldType)
  fieldType!: FieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateFieldDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  order?: number;
}
