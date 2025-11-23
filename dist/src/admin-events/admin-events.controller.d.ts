import { Response } from 'express';
import { AdminEventsService } from './admin-events.service';
export declare class AdminEventsController {
    private readonly adminEventsService;
    constructor(adminEventsService: AdminEventsService);
    updateEvent(eventId: string, req: any, body: any): Promise<{
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
    deleteEvent(eventId: string, req: any): Promise<{
        success: boolean;
    }>;
    getHistory(req: any): Promise<{
        totalRegistrations: number;
        municipalitiesCount: number;
        municipalities: {
            id: string;
            state: string;
            classes: {
                id: string;
                createdAt: Date;
                status: import("@prisma/client").$Enums.MunicipalityClassStatus;
                limit: number;
                currentCount: number;
                classNumber: number;
                closedAt: Date | null;
            }[];
            municipality: string;
            defaultLimit: number;
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
    getRegions(eventId: string, req: any): Promise<{
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
    listRegistrations(eventId: string, req: any): Promise<{
        event: {
            id: string;
            title: string;
        };
        registrations: ({
            municipalityClass: {
                classNumber: number;
            } | null;
            municipality: {
                state: string;
                municipality: string;
            } | null;
        } & {
            id: string;
            email: string;
            name: string;
            phone: string;
            cpf: string;
            participantType: import("@prisma/client").$Enums.ParticipantType;
            state: string;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.RegistrationStatus;
            userId: string | null;
            eventId: string;
            municipalityId: string | null;
            municipalityClassId: string | null;
            batchNumber: number;
            cep: string;
            locality: string;
            otherType: string | null;
            pondCount: number | null;
            waterDepth: number | null;
        })[];
    }>;
    exportRegistrations(eventId: string, format: string | undefined, fields: string | string[] | undefined, req: any & {
        res?: Response;
    }): Promise<void>;
    updateMunicipalityLimit(limitId: string, req: any, body: {
        defaultLimit?: number;
    }): Promise<{
        id: string;
        state: string;
        createdAt: Date;
        updatedAt: Date;
        eventId: string;
        municipality: string;
        defaultLimit: number;
    }>;
    closeClass(classId: string, req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.MunicipalityClassStatus;
        limit: number;
        currentCount: number;
        municipalityLimitId: string;
        classNumber: number;
        closedAt: Date | null;
    }>;
}
