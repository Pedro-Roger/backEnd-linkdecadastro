import { PrismaService } from '../prisma/prisma.service';
export declare class LessonsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getComments(lessonId: string): Promise<({
        user: {
            id: string;
            email: string;
            name: string;
            avatar: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        lessonId: string;
        content: string;
    })[]>;
    addComment(userId: string, lessonId: string, content: string): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            avatar: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        lessonId: string;
        content: string;
    }>;
    updateProgress(userId: string, lessonId: string, data: {
        watchedTime: number;
        completed: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        completedAt: Date | null;
        userId: string;
        completed: boolean;
        lessonId: string;
        watchedTime: number;
    }>;
    getProgress(userId: string, lessonId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        completedAt: Date | null;
        userId: string;
        completed: boolean;
        lessonId: string;
        watchedTime: number;
    } | {
        completed: false;
        watchedTime: number;
    }>;
}
