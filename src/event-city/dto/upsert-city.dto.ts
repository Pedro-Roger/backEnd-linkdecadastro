import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertCityDto {
  @IsString()
  municipality: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultLimit?: number;
}
