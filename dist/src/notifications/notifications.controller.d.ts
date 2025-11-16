import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    list(req: any, status?: string, limit?: string): Promise<{
        notifications: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            status: import("@prisma/client").$Enums.NotificationStatus;
            type: import("@prisma/client").$Enums.NotificationType;
            userId: string;
            link: string | null;
            message: string;
        }[];
        unreadCount: number;
    }>;
    update(req: any, body: {
        notificationId: string;
        status: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: import("@prisma/client").$Enums.NotificationStatus;
        type: import("@prisma/client").$Enums.NotificationType;
        userId: string;
        link: string | null;
        message: string;
    }>;
}
