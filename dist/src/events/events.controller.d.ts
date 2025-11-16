import { EventsService } from './events.service';
export declare class EventsController {
    private readonly eventsService;
    constructor(eventsService: EventsService);
    listEvents(req: any): Promise<({
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
    createEvent(req: any, body: any): Promise<{
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
