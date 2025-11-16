import { RegistrationsService } from './registrations.service';
export declare class RegistrationsController {
    private readonly registrationsService;
    constructor(registrationsService: RegistrationsService);
    create(body: any): Promise<{
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
    }>;
    list(eventId?: string): Promise<({
        event: {
            title: string;
        };
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
    })[]>;
}
