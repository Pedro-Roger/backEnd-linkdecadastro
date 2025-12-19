import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    Min,
    ValidateNested,
} from 'class-validator';

class FirstLessonDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    @Transform(({ value }) => (value === '' ? undefined : value))
    description?: string;

    @IsString()
    @IsNotEmpty()
    @Matches(
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
        { message: 'URL do vídeo deve ser do YouTube' },
    )
    videoUrl: string;

    @IsInt()
    @IsOptional()
    order?: number;
}

class RegionQuotaDto {
    @IsString()
    @IsNotEmpty()
    state: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsInt()
    @Min(0)
    @Transform(({ value }) => {
        if (value === '' || value === null) return 0;
        const parsed = Number(value);
        return isNaN(parsed) ? 0 : parsed;
    })
    limit: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === null) return 0;
        const parsed = Number(value);
        return isNaN(parsed) ? 0 : parsed;
    })
    waitlistLimit?: number;
}

export class CreateCourseDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    @Transform(({ value }) => (value === '' ? undefined : value))
    description?: string;

    @IsString()
    @IsOptional()
    @IsUrl()
    @Transform(({ value }) => (value === '' ? undefined : value))
    bannerUrl?: string;

    @IsString()
    @IsOptional()
    status?: string;

    @IsString()
    @IsOptional()
    @IsEnum(['ONLINE', 'PRESENCIAL'])
    type?: 'ONLINE' | 'PRESENCIAL';

    @IsInt()
    @Min(0)
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === null) return undefined;
        const parsed = Number(value);
        return isNaN(parsed) ? undefined : parsed;
    })
    maxEnrollments?: number;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === '') return undefined;
        return value;
    })
    waitlistEnabled?: boolean;

    @IsInt()
    @Min(0)
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === null) return 0;
        const parsed = Number(value);
        return isNaN(parsed) ? 0 : parsed;
    })
    waitlistLimit?: number;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === '') return undefined;
        return value;
    })
    regionRestrictionEnabled?: boolean;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === '') return undefined;
        return value;
    })
    allowAllRegions?: boolean;

    @IsInt()
    @Min(0)
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === null) return undefined;
        const parsed = Number(value);
        return isNaN(parsed) ? undefined : parsed;
    })
    defaultRegionLimit?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RegionQuotaDto)
    @IsOptional()
    regionQuotas?: RegionQuotaDto[];

    @IsDateString()
    @IsOptional()
    @Transform(({ value }) => (value === '' ? undefined : value))
    startDate?: string;

    @IsDateString()
    @IsOptional()
    @Transform(({ value }) => (value === '' ? undefined : value))
    endDate?: string;

    @IsString()
    @IsOptional()
    @Matches(/^[a-z0-9-]+$/, {
        message: 'URL personalizada deve conter apenas letras minúsculas, números e hífens',
    })
    @Transform(({ value }) => (value === '' ? undefined : value))
    slug?: string;

    @ValidateNested()
    @Type(() => FirstLessonDto)
    @IsOptional()
    firstLesson?: FirstLessonDto;
}
