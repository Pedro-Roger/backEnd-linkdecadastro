import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(body: {
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
    }): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
    }>;
    login(body: {
        email: string;
        password: string;
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
        };
    }>;
    me(req: any): Promise<{
        id: string;
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.UserRole;
        avatar: string | null;
        bio: string | null;
        createdAt: Date;
    } | null>;
}
