import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCityStatusDto {
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  closedMessage?: string | null;
}
