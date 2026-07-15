import { IsString, IsOptional, IsInt, IsBoolean, IsUUID, IsISO8601, MinLength } from 'class-validator';

export class CreatePriorityFlagDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  weight?: number;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdatePriorityFlagDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  weight?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignPriorityFlagDto {
  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
