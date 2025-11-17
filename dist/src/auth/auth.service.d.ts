import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
interface RegisterDto {
    name: string;
    email: string;
    password: string;
    cpf?: string;
    birthDate?: string;
    participantType?: 'ESTUDANTE' | 'PROFESSOR' | 'PESQUISADOR' | 'PRODUTOR';
    hectares?: number;
    state?: string;
    city?: string;
    phone?: string;
}
interface LoginDto {
    email: string;
    password: string;
}
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(data: RegisterDto): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
    }>;
    validateUser(email: string, password: string): Promise<{
        id: string;
        email: string;
        password: string | null;
        name: string;
        fullName: string | null;
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
        needsProfileCompletion: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    login(data: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
            needsProfileCompletion: boolean;
            phone: string | null;
            state: string | null;
            city: string | null;
        };
    }>;
    getProfile(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatar: string | null;
        bio: string | null;
        createdAt: Date;
    } | null>;
    googleLogin(googleUser: {
        email: string;
        name: string;
        picture?: string | null;
    }): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
            needsProfileCompletion: boolean;
            phone: string | null;
            state: string | null;
            city: string | null;
            avatar: string | null;
        };
    }>;
}
export {};
