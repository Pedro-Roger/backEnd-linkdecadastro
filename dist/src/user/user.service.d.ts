import { PrismaService } from '../prisma/prisma.service';
export declare class UserService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getProfile(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        phone: string | null;
        cpf: string | null;
        birthDate: Date | null;
        participantType: import("@prisma/client").$Enums.ParticipantType | null;
        hectares: number | null;
        state: string | null;
        city: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        avatar: string | null;
        bio: string | null;
        createdAt: Date;
    } | null>;
    updateProfile(userId: string, data: {
        name: string;
        bio?: string;
        avatar?: string;
    }): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatar: string | null;
        bio: string | null;
    }>;
    completeProfile(userId: string, data: {
        fullName: string;
        phone: string;
        cpf: string;
    }): Promise<{
        message: string;
        user: {
            id: string;
            email: string;
            name: string;
            fullName: string | null;
            phone: string | null;
            cpf: string | null;
        };
    }>;
    getStats(userId: string): Promise<{
        coursesEnrolled: number;
        lessonsCompleted: number;
        totalProgress: number;
    }>;
}
