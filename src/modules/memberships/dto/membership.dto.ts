import { IsString, IsOptional, IsBoolean, IsUUID, IsEnum, MinLength, Matches } from 'class-validator';
import { UserRole } from 'selfless-sdk';
import { PHONE_REGEX, PHONE_INVALID_MESSAGE } from '../../auth/dto/phone.constant.js';

export class InviteMemberDto {
  @Matches(PHONE_REGEX, { message: PHONE_INVALID_MESSAGE })
  phone!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
