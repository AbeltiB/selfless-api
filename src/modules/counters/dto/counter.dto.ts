import { IsString, IsOptional, IsBoolean, IsUUID, MinLength } from 'class-validator';

export class CreateCounterGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateCounterGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class CreateCounterDto {
  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}

export class UpdateCounterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
