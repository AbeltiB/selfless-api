import { IsNumberString, IsOptional, IsString, Length, Matches } from 'class-validator';
import { PHONE_REGEX, PHONE_INVALID_MESSAGE } from './phone.constant.js';

export class LoginDto {
  @Matches(PHONE_REGEX, { message: PHONE_INVALID_MESSAGE })
  phone!: string;

  @IsNumberString()
  @Length(6, 6)
  pin!: string;

  @IsOptional()
  @IsString()
  otpToken?: string;
}
