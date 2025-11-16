import { LessonsService } from './lessons.service';
export declare class LessonsController {
    private readonly lessonsService;
    constructor(lessonsService: LessonsService);
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
    addComment(lessonId: string, req: any, body: {
        content: string;
    }): Promise<{
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
    updateProgress(lessonId: string, req: any, body: {
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
    getProgress(lessonId: string, req: any): Promise<{
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
