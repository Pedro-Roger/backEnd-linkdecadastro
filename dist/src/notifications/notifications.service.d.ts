import { PrismaService } from '../prisma/prisma.service';
export declare class NotificationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listNotifications(userId: string, status?: string | null, limit?: number): Promise<{
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
    updateNotificationStatus(userId: string, notificationId: string, status: string): Promise<{
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
