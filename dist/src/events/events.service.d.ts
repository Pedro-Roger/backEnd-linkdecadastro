import { PrismaService } from '../prisma/prisma.service';
export declare class EventsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listEvents(userRole: string | undefined): Promise<({
        _count: {
            registrations: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        bannerUrl: string | null;
        status: import("@prisma/client").$Enums.EventStatus;
        createdBy: string;
        linkId: string;
        maxRegistrations: number | null;
    })[]>;
    createEvent(userId: string, userRole: string | undefined, body: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        bannerUrl: string | null;
        status: import("@prisma/client").$Enums.EventStatus;
        createdBy: string;
        linkId: string;
        maxRegistrations: number | null;
    }>;
    getEventByLink(linkId: string): Promise<{
        _count: {
            registrations: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        bannerUrl: string | null;
        status: import("@prisma/client").$Enums.EventStatus;
        createdBy: string;
        linkId: string;
        maxRegistrations: number | null;
    }>;
}
