import { UserService } from './user.service';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    getProfile(req: any): Promise<{
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
    updateProfile(req: any, body: {
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
    completeProfile(req: any, body: {
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
    getStats(req: any): Promise<{
        coursesEnrolled: number;
        lessonsCompleted: number;
        totalProgress: number;
    }>;
}
