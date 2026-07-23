import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

const BANNER_VALUE_REGEX =
  /^(https?:\/\/.+|\/.+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)$/;

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
  @IsNotEmpty({ message: 'TÃ­tulo Ã© obrigatÃ³rio' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'DescriÃ§Ã£o Ã© obrigatÃ³ria' })
  description: string;

  @IsString()
  @IsOptional()
  @Matches(BANNER_VALUE_REGEX, {
    message:
      'Banner invÃ¡lido. Use uma URL http(s), caminho /uploads/... ou imagem base64',
  })
  @Transform(({ value }: { value: any }) => (value === '' ? undefined : value))
  bannerUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'URL personalizada deve conter apenas letras minÃºsculas, nÃºmeros e hÃ­fens',
  })
  @Transform(({ value }: { value: any }) => (value === '' ? undefined : value))
  slug?: string;

  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, {
    message: 'Link do grupo deve ser uma URL válida',
  })
  @Transform(({ value }: { value: any }) => (value === '' ? undefined : value))
  groupInviteLink?: string;

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
