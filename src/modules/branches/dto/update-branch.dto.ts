import { IsString, IsOptional, IsNumber, IsEnum, IsObject } from 'class-validator';
import { BranchStatus } from 'selfless-sdk';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsNumber()
  maxCapacity?: number;

  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;

  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, unknown>;
}
