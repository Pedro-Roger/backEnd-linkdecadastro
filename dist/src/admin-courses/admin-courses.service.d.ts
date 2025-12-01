import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
export declare class AdminCoursesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private assertAdmin;
    listCourses(userRole?: string): Promise<({
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
    listAllEnrollmentsForWhatsApp(userRole?: string, filters?: {
        city?: string;
        state?: string;
        participantType?: string;
    }): Promise<{
        total: number;
        participantes: {
            id_contato: string;
            nome: string;
            email: string;
            telefone: string;
            cidade: string;
            estado: string;
            participante_tipo: string;
            produtor: boolean;
            professor: boolean;
            estudante: boolean;
        }[];
    }>;
    getCourseById(courseId: string, userId: string, userRole?: string): Promise<{
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
    private extractYouTubeId;
    createCourse(userId: string, userRole: string | undefined, body: CreateCourseDto): Promise<{
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
    deleteCourse(courseId: string, userId: string, userRole?: string): Promise<void>;
    updateCourse(courseId: string, userId: string, userRole: string | undefined, body: UpdateCourseDto): Promise<{
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
    listLessons(courseId: string, userRole?: string): Promise<({
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
    createLesson(courseId: string, userId: string, userRole: string | undefined, body: any): Promise<{
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
    getLesson(courseId: string, lessonId: string, userId: string, userRole?: string): Promise<{
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
    updateLesson(courseId: string, lessonId: string, userId: string, userRole: string | undefined, body: any): Promise<{
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
    deleteLesson(courseId: string, lessonId: string, userId: string, userRole?: string): Promise<void>;
    listEnrollments(courseId: string, userRole?: string): Promise<any[]>;
    private statusLabels;
    exportEnrollments(courseId: string, userRole: string | undefined, formatParam?: string, fieldsParam?: string[]): Promise<{
        buffer: any;
        contentType: string;
        filename: string;
    }>;
    listCourseClasses(courseId: string, userRole: string | undefined): Promise<{
        course: {
            id: string;
            title: string;
            maxEnrollments: number | null;
        };
        classes: any;
        activeClassNumber: any;
        activeClassLimit: any;
        activeClassCount: number | null;
    }>;
    createCourseClass(courseId: string, userRole: string | undefined, body: {
        limit: number;
    }): Promise<any>;
    closeCourseClass(classId: string, userRole: string | undefined): Promise<any>;
}
