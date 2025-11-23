import { AdminCoursesService } from './admin-courses.service';
import type { Response } from 'express';
export declare class AdminCoursesController {
    private readonly adminCoursesService;
    constructor(adminCoursesService: AdminCoursesService);
    listCourses(req: any): Promise<({
        creator: {
            email: string;
            name: string;
        };
        lessons: {
            id: string;
            title: string;
            order: number;
        }[];
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
        _count: {
            enrollments: number;
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
    })[]>;
    createCourse(req: any, body: any): Promise<{
        creator: {
            email: string;
            name: string;
        };
        lessons: {
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
        }[];
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
        _count: {
            enrollments: number;
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
    getCourse(courseId: string, req: any): Promise<{
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
        _count: {
            enrollments: number;
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
    deleteCourse(courseId: string, req: any): Promise<{
        message: string;
    }>;
    updateCourse(courseId: string, req: any, body: any): Promise<{
        creator: {
            email: string;
            name: string;
        };
        lessons: {
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
        }[];
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
        _count: {
            enrollments: number;
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
    listLessons(courseId: string, req: any): Promise<({
        _count: {
            comments: number;
            progress: number;
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
    })[]>;
    createLesson(courseId: string, req: any, body: any): Promise<{
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
    }>;
    getLesson(courseId: string, lessonId: string, req: any): Promise<{
        course: {
            id: string;
            title: string;
            createdBy: string;
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
    }>;
    updateLesson(courseId: string, lessonId: string, req: any, body: any): Promise<{
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
    }>;
    deleteLesson(courseId: string, lessonId: string, req: any): Promise<{
        message: string;
    }>;
    listEnrollments(courseId: string, req: any): Promise<any[]>;
    exportGet(courseId: string, format: string | undefined, fields: string | string[] | undefined, req: any & {
        res?: Response;
    }): Promise<void>;
    listCourseClasses(courseId: string, req: any): Promise<{
        course: {
            id: string;
            title: string;
            maxEnrollments: number | null;
        };
        classes: {
            id: string;
            classNumber: number;
            limit: number;
            currentCount: number;
            status: import("@prisma/client").$Enums.CourseClassStatus;
            createdAt: Date;
            closedAt: Date | null;
            totalEnrollments: number;
        }[];
        activeClassNumber: number | null;
        activeClassLimit: number | null;
        activeClassCount: number | null;
    }>;
    createCourseClass(courseId: string, req: any, body: {
        limit: number;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CourseClassStatus;
        courseId: string;
        limit: number;
        currentCount: number;
        classNumber: number;
        closedAt: Date | null;
    }>;
    closeCourseClass(classId: string, req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CourseClassStatus;
        courseId: string;
        limit: number;
        currentCount: number;
        classNumber: number;
        closedAt: Date | null;
    }>;
}
