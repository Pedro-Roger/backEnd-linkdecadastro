import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class MunicipalityLimitDto {
  @IsString()
  @IsNotEmpty()
  municipality: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsInt()
  @Min(0)
  @Transform(({ value }: { value: any }) => {
    if (value === '' || value === null) return 0;
    const parsed = Number(value);
    return isNaN(parsed) ? 0 : parsed;
  })
  defaultLimit: number;
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty({ message: 'Título é obrigatório' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  description: string;

  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'URL do banner inválida' })
  @Transform(({ value }: { value: any }) => (value === '' ? undefined : value))
  bannerUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'URL personalizada deve conter apenas letras minúsculas, números e hífens',
  })
  @Transform(({ value }: { value: any }) => (value === '' ? undefined : value))
  slug?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }: { value: any }) => {
    if (value === '' || value === null) return undefined;
    const parsed = Number(value);
    return isNaN(parsed) ? undefined : parsed;
  })
  maxRegistrations?: number;

  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MunicipalityLimitDto)
  @IsOptional()
  municipalities?: MunicipalityLimitDto[];
}
