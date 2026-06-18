import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

const BANNER_VALUE_REGEX =
  /^(https?:\/\/.+|\/.+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)$/;

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @Matches(BANNER_VALUE_REGEX, {
    message:
      'Banner invÃ¡lido. Use uma URL http(s), caminho /uploads/... ou imagem base64',
  })
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  bannerUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'URL personalizada deve conter apenas letras minÃºsculas, nÃºmeros e hÃ­fens',
  })
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }: { value: unknown }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  })
  maxRegistrations?: number;

  @IsString()
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'CLOSED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  whatsappGroupsEnabled?: boolean;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  whatsappSessionId?: string | null;
}
