import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateCityStatusDto {
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  closedMessage?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultLimit?: number;
}
