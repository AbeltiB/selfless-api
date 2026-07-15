import { IsString, IsNumberString, Length, IsOptional, IsEmail, MinLength } from 'class-validator';

export class SetPinDto {
  @IsString()
  otpToken!: string;

  @IsNumberString()
  @Length(6, 6)
  pin!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
