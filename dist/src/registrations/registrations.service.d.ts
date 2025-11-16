import { PrismaService } from '../prisma/prisma.service';
import { ParticipantType } from '@prisma/client';
import { EmailService } from '../email/email.service';
export declare class RegistrationsService {
    private readonly prisma;
    private readonly emailService;
    constructor(prisma: PrismaService, emailService: EmailService);
    createRegistration(data: {
        eventId: string;
        name: string;
        cpf: string;
        phone: string;
        email: string;
        cep: string;
        locality: string;
        city: string;
        state: string;
        participantType: ParticipantType;
        otherType?: string;
        pondCount?: number;
        waterDepth?: number;
    }): Promise<{
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
    handleRegistration(body: any): Promise<{
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
    listRegistrations(eventId?: string | null): Promise<({
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
