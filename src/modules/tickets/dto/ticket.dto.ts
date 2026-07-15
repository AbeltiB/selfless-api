import { IsString, IsOptional, IsUUID, IsInt, IsObject, IsEnum, Matches } from 'class-validator';
import { TicketStatus } from 'selfless-sdk';
import { PHONE_REGEX, PHONE_INVALID_MESSAGE } from '../../auth/dto/phone.constant.js';

export class IssueTicketDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @Matches(PHONE_REGEX, { message: PHONE_INVALID_MESSAGE })
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @IsOptional()
  @IsUUID(undefined, { each: true })
  priorityFlagIds?: string[];
}

export class SelfIssueTicketDto extends IssueTicketDto {
  @IsUUID()
  organizationId!: string;
}

export class TransitionTicketDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsOptional()
  @IsUUID()
  counterId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdvanceTicketDto {
  @IsUUID()
  transitionId!: string;
}

export class TransferTicketDto {
  @IsOptional()
  @IsUUID()
  toServiceId?: string;

  @IsOptional()
  @IsUUID()
  toStepId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
