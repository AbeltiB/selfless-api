import { IsBoolean, IsOptional } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @IsBoolean()
  revokeDevice?: boolean;
}
