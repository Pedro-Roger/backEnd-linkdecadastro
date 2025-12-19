import { Type, Transform } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    Min,
    ValidateNested,
} from 'class-validator';

class RegionQuotaUpdateDto {
    @IsString()
    @IsOptional()
    id?: string;

    @IsString()
    @IsNotEmpty()
    state: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsInt()
    @Min(0)
    limit: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    waitlistLimit?: number;
}

export class UpdateCourseDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    @IsUrl()
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
    maxEnrollments?: number;

    @IsBoolean()
    @IsOptional()
    waitlistEnabled?: boolean;

    @IsInt()
    @Min(0)
    @IsOptional()
    waitlistLimit?: number;

    @IsBoolean()
    @IsOptional()
    regionRestrictionEnabled?: boolean;

    @IsBoolean()
    @IsOptional()
    allowAllRegions?: boolean;

    @IsInt()
    @Min(0)
    @IsOptional()
    defaultRegionLimit?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RegionQuotaUpdateDto)
    @IsOptional()
    regionQuotas?: RegionQuotaUpdateDto[];

    @IsDateString()
    @IsOptional()
    startDate?: string;

    @IsDateString()
    @IsOptional()
    endDate?: string;

    @IsString()
    @IsOptional()
    @Matches(/^[a-z0-9-]+$/, {
        message: 'URL personalizada deve conter apenas letras minúsculas, números e hífens',
    })
    slug?: string;
}
