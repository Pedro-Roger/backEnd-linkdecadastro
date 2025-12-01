declare class RegionQuotaUpdateDto {
    id?: string;
    state: string;
    city?: string;
    limit: number;
    waitlistLimit?: number;
}
export declare class UpdateCourseDto {
    title?: string;
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
    regionQuotas?: RegionQuotaUpdateDto[];
    startDate?: string;
    endDate?: string;
    slug?: string;
}
export {};
