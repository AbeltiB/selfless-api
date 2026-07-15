import { IsEnum, Matches } from 'class-validator';
import { OtpPurpose } from 'selfless-sdk';
import { PHONE_REGEX, PHONE_INVALID_MESSAGE } from './phone.constant.js';

export class RequestOtpDto {
  @Matches(PHONE_REGEX, { message: PHONE_INVALID_MESSAGE })
  phone!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}
