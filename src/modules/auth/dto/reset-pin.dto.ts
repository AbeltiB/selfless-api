import { IsNumberString, IsString, Length } from 'class-validator';

export class ResetPinDto {
  @IsString()
  otpToken!: string;

  @IsNumberString()
  @Length(6, 6)
  newPin!: string;
}
