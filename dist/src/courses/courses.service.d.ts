import { PrismaService } from '../prisma/prisma.service';
export declare class CoursesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listCourses(filter?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        bannerUrl: string | null;
        status: string;
        type: import("@prisma/client").$Enums.CourseType;
        maxEnrollments: number | null;
        waitlistLimit: number;
        waitlistEnabled: boolean;
        regionRestrictionEnabled: boolean;
        allowAllRegions: boolean;
        startDate: Date | null;
        endDate: Date | null;
        slug: string | null;
        creator: {
            name: string;
        };
        lessons: {
            id: string;
            title: string;
            order: number;
        }[];
        createdBy: string;
        _count: {
            enrollments: number;
            lessons: number;
        };
    }[]>;
    listMyCourses(userId: string): Promise<{
        progress: number;
        completedLessons: number;
        totalLessons: number;
        lessons: {
            id: string;
            title: string;
            order: number;
        }[];
        _count: {
            lessons: number;
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        bannerUrl: string | null;
        status: string;
        type: import("@prisma/client").$Enums.CourseType;
        maxEnrollments: number | null;
        waitlistLimit: number;
        waitlistEnabled: boolean;
        regionRestrictionEnabled: boolean;
        allowAllRegions: boolean;
        defaultRegionLimit: number | null;
        startDate: Date | null;
        endDate: Date | null;
        slug: string | null;
        createdBy: string;
    }[]>;
    getCourseById(courseId: string, userId?: string): Promise<({
        creator: {
            email: string;
            name: string;
        };
        lessons: ({
            _count: {
                comments: number;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string | null;
            bannerUrl: string | null;
            videoUrl: string | null;
            duration: string | null;
            order: number;
            courseId: string;
        })[];
        regionQuotas: {
            id: string;
            state: string;
            city: string | null;
            createdAt: Date;
            updatedAt: Date;
            waitlistLimit: number;
            courseId: string;
            limit: number;
            currentCount: number;
            waitlistCount: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        bannerUrl: string | null;
        status: string;
        type: import("@prisma/client").$Enums.CourseType;
        maxEnrollments: number | null;
        waitlistLimit: number;
        waitlistEnabled: boolean;
        regionRestrictionEnabled: boolean;
        allowAllRegions: boolean;
        defaultRegionLimit: number | null;
        startDate: Date | null;
        endDate: Date | null;
        slug: string | null;
        createdBy: string;
    }) | {
        enrollment: {
            course: {
                lessons: ({
                    progress: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        completedAt: Date | null;
                        userId: string;
                        completed: boolean;
                        lessonId: string;
                        watchedTime: number;
                    }[];
                } & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    title: string;
                    description: string | null;
                    bannerUrl: string | null;
                    videoUrl: string | null;
                    duration: string | null;
                    order: number;
                    courseId: string;
                })[];
                regionQuotas: {
                    id: string;
                    state: string;
                    city: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                    waitlistLimit: number;
                    courseId: string;
                    limit: number;
                    currentCount: number;
                    waitlistCount: number;
                }[];
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                title: string;
                description: string | null;
                bannerUrl: string | null;
                status: string;
                type: import("@prisma/client").$Enums.CourseType;
                maxEnrollments: number | null;
                waitlistLimit: number;
                waitlistEnabled: boolean;
                regionRestrictionEnabled: boolean;
                allowAllRegions: boolean;
                defaultRegionLimit: number | null;
                startDate: Date | null;
                endDate: Date | null;
                slug: string | null;
                createdBy: string;
            };
        } & {
            id: string;
            cpf: string | null;
            birthDate: Date | null;
            participantType: import("@prisma/client").$Enums.ParticipantType | null;
            hectares: number | null;
            state: string | null;
            city: string | null;
            createdAt: Date;
            updatedAt: Date;
            progress: number;
            status: import("@prisma/client").$Enums.EnrollmentStatus;
            completedAt: Date | null;
            waitlistPosition: number | null;
            eligibilityReason: string | null;
            whatsappNumber: string | null;
            userId: string;
            courseId: string;
            regionQuotaId: string | null;
        };
        progress: number;
        creator: {
            email: string;
            name: string;
        };
        lessons: ({
            _count: {
                comments: number;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string | null;
            bannerUrl: string | null;
            videoUrl: string | null;
            duration: string | null;
            order: number;
            courseId: string;
        })[];
        regionQuotas: {
            id: string;
            state: string;
            city: string | null;
            createdAt: Date;
            updatedAt: Date;
            waitlistLimit: number;
            courseId: string;
            limit: number;
            currentCount: number;
            waitlistCount: number;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        bannerUrl: string | null;
        status: string;
        type: import("@prisma/client").$Enums.CourseType;
        maxEnrollments: number | null;
        waitlistLimit: number;
        waitlistEnabled: boolean;
        regionRestrictionEnabled: boolean;
        allowAllRegions: boolean;
        defaultRegionLimit: number | null;
        startDate: Date | null;
        endDate: Date | null;
        slug: string | null;
        createdBy: string;
    }>;
    getCourseBySlug(slug: string): Promise<{
        creator: {
            email: string;
            name: string;
        };
        lessons: {
            id: string;
            title: string;
            description: string | null;
            bannerUrl: string | null;
            videoUrl: string | null;
            duration: string | null;
            order: number;
        }[];
        _count: {
            enrollments: number;
            lessons: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        bannerUrl: string | null;
        status: string;
        type: import("@prisma/client").$Enums.CourseType;
        maxEnrollments: number | null;
        waitlistLimit: number;
        waitlistEnabled: boolean;
        regionRestrictionEnabled: boolean;
        allowAllRegions: boolean;
        defaultRegionLimit: number | null;
        startDate: Date | null;
        endDate: Date | null;
        slug: string | null;
        createdBy: string;
    }>;
    checkEnrollment(userId: string, courseId: string): Promise<{
        enrolled: boolean;
        status: import("@prisma/client").$Enums.EnrollmentStatus | null;
        waitlistPosition: number | null;
        eligibilityReason: string | null;
    }>;
    enrollInCourse(userId: string, courseId: string, body: {
        cpf?: string;
        birthDate?: string;
        participantType?: string;
        hectares?: any;
        state?: string;
        city?: string;
        whatsappNumber?: string;
    }): Promise<{
        error: {
            message: string;
            status: number;
        };
        enrollment?: undefined;
        metadata?: undefined;
        course?: undefined;
    } | {
        enrollment: {
            course: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                title: string;
                description: string | null;
                bannerUrl: string | null;
                status: string;
                type: import("@prisma/client").$Enums.CourseType;
                maxEnrollments: number | null;
                waitlistLimit: number;
                waitlistEnabled: boolean;
                regionRestrictionEnabled: boolean;
                allowAllRegions: boolean;
                defaultRegionLimit: number | null;
                startDate: Date | null;
                endDate: Date | null;
                slug: string | null;
                createdBy: string;
            };
        } & {
            id: string;
            cpf: string | null;
            birthDate: Date | null;
            participantType: import("@prisma/client").$Enums.ParticipantType | null;
            hectares: number | null;
            state: string | null;
            city: string | null;
            createdAt: Date;
            updatedAt: Date;
            progress: number;
            status: import("@prisma/client").$Enums.EnrollmentStatus;
            completedAt: Date | null;
            waitlistPosition: number | null;
            eligibilityReason: string | null;
            whatsappNumber: string | null;
            userId: string;
            courseId: string;
            regionQuotaId: string | null;
        };
        metadata: {
            isFull: boolean;
            waitlistPosition: number | null;
            regionQuotaId: string | null;
        };
        course: {
            id: string;
            title: string;
            waitlistEnabled: boolean;
        };
        error?: undefined;
    }>;
    enrollInCourseByEmail(courseId: string, body: {
        email: string;
        name?: string;
        cpf?: string;
        birthDate?: string;
        participantType?: string;
        hectares?: any;
        state?: string;
        city?: string;
        whatsappNumber?: string;
    }): Promise<{
        error: {
            message: string;
            status: number;
        };
        enrollment?: undefined;
        metadata?: undefined;
        course?: undefined;
    } | {
        enrollment: {
            course: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                title: string;
                description: string | null;
                bannerUrl: string | null;
                status: string;
                type: import("@prisma/client").$Enums.CourseType;
                maxEnrollments: number | null;
                waitlistLimit: number;
                waitlistEnabled: boolean;
                regionRestrictionEnabled: boolean;
                allowAllRegions: boolean;
                defaultRegionLimit: number | null;
                startDate: Date | null;
                endDate: Date | null;
                slug: string | null;
                createdBy: string;
            };
        } & {
            id: string;
            cpf: string | null;
            birthDate: Date | null;
            participantType: import("@prisma/client").$Enums.ParticipantType | null;
            hectares: number | null;
            state: string | null;
            city: string | null;
            createdAt: Date;
            updatedAt: Date;
            progress: number;
            status: import("@prisma/client").$Enums.EnrollmentStatus;
            completedAt: Date | null;
            waitlistPosition: number | null;
            eligibilityReason: string | null;
            whatsappNumber: string | null;
            userId: string;
            courseId: string;
            regionQuotaId: string | null;
        };
        metadata: {
            isFull: boolean;
            waitlistPosition: number | null;
            regionQuotaId: string | null;
        };
        course: {
            id: string;
            title: string;
            waitlistEnabled: boolean;
        };
        error?: undefined;
    }>;
}
