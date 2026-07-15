import { IsEnum, Matches, Length, IsNumberString } from 'class-validator';
import { OtpPurpose } from 'selfless-sdk';
import { PHONE_REGEX, PHONE_INVALID_MESSAGE } from './phone.constant.js';

export class VerifyOtpDto {
  @Matches(PHONE_REGEX, { message: PHONE_INVALID_MESSAGE })
  phone!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @IsNumberString()
  @Length(6, 6)
  code!: string;
}
