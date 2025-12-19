
import { Transform } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    Min,
} from 'class-validator';

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
    @Transform(({ value }) => (value === '' ? undefined : value))
    bannerUrl?: string;

    @IsString()
    @IsOptional()
    @Matches(/^[a-z0-9-]+$/, {
        message: 'URL personalizada deve conter apenas letras minúsculas, números e hífens',
    })
    @Transform(({ value }) => (value === '' ? undefined : value))
    slug?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === null) return undefined;
        const parsed = Number(value);
        return isNaN(parsed) ? undefined : parsed;
    })
    maxRegistrations?: number;
}
