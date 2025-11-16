import { PrismaService } from '../prisma/prisma.service';
export declare class AdminEventsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private assertAdmin;
    updateEvent(eventId: string, userRole: string | undefined, body: any): Promise<{
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
    deleteEvent(eventId: string, userRole: string | undefined): Promise<{
        success: boolean;
    }>;
    getHistory(userRole: string | undefined): Promise<{
        totalRegistrations: number;
        municipalitiesCount: number;
        municipalities: {
            id: string;
            state: string;
            municipality: string;
            defaultLimit: number;
            classes: {
                id: string;
                createdAt: Date;
                status: import("@prisma/client").$Enums.MunicipalityClassStatus;
                limit: number;
                currentCount: number;
                classNumber: number;
                closedAt: Date | null;
            }[];
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        bannerUrl: string | null;
        status: import("@prisma/client").$Enums.EventStatus;
        maxRegistrations: number | null;
    }[]>;
    getRegionsSummary(eventId: string, userRole: string | undefined): Promise<{
        regions: {
            id: string;
            municipality: string;
            state: string;
            defaultLimit: number;
            totalRegistrations: number;
            byParticipantType: Partial<Record<import("@prisma/client").$Enums.ParticipantType, number>>;
            classes: {
                id: string;
                classNumber: number;
                limit: number;
                currentCount: number;
                status: import("@prisma/client").$Enums.MunicipalityClassStatus;
                createdAt: Date;
                closedAt: Date | null;
                registrations: number;
            }[];
            activeClassNumber: number | null;
            activeClassLimit: number | null;
            activeClassCount: number | null;
        }[];
        overall: {
            totalRegistrations: number;
            byParticipantType: Partial<Record<import("@prisma/client").$Enums.ParticipantType, number>>;
            byState: {
                state: string;
                total: number;
                byParticipantType: Partial<Record<import("@prisma/client").$Enums.ParticipantType, number>>;
            }[];
        };
    }>;
}
