declare class FirstLessonDto {
    title: string;
    description?: string;
    videoUrl: string;
    order?: number;
}
declare class RegionQuotaDto {
    state: string;
    city?: string;
    limit: number;
    waitlistLimit?: number;
}
export declare class CreateCourseDto {
    title: string;
    description?: string;
    bannerUrl?: string;
    status?: string;
    type?: 'ONLINE' | 'PRESENCIAL';
    maxEnrollments?: number;
    waitlistEnabled?: boolean;
    waitlistLimit?: number;
    regionRestrictionEnabled?: boolean;
    allowAllRegions?: boolean;
    defaultRegionLimit?: number;
    regionQuotas?: RegionQuotaDto[];
    startDate?: string;
    endDate?: string;
    slug?: string;
    firstLesson?: FirstLessonDto;
}
export {};
