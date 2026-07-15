import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { OrgStatus } from 'selfless-sdk';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsEnum(OrgStatus)
  status?: OrgStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
