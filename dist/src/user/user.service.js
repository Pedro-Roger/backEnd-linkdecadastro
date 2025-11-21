"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let UserService = class UserService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProfile(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                bio: true,
                role: true,
                phone: true,
                state: true,
                city: true,
                participantType: true,
                hectares: true,
                cpf: true,
                birthDate: true,
                createdAt: true,
            },
        });
    }
    async updateProfile(userId, data) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name,
                bio: data.bio,
                avatar: data.avatar || null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                bio: true,
                role: true,
            },
        });
    }
    async completeProfile(userId, data) {
        const existingUserWithCpf = await this.prisma.user.findFirst({
            where: {
                cpf: data.cpf,
                id: { not: userId },
            },
        });
        if (existingUserWithCpf) {
            throw new common_1.BadRequestException('CPF já está em uso por outro usuário');
        }
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                fullName: data.fullName.trim(),
                phone: data.phone.trim(),
                cpf: data.cpf,
                needsProfileCompletion: false,
            },
        });
        return {
            message: 'Perfil completado com sucesso',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                fullName: updatedUser.fullName,
                phone: updatedUser.phone,
                cpf: updatedUser.cpf,
            },
        };
    }
    async getStats(userId) {
        const coursesEnrolled = await this.prisma.enrollment.count({
            where: { userId },
        });
        const lessonsCompleted = await this.prisma.lessonProgress.count({
            where: {
                userId,
                completed: true,
            },
        });
        const enrollments = await this.prisma.enrollment.findMany({
            where: { userId },
            select: { progress: true },
        });
        const totalProgress = enrollments.length > 0
            ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) /
                enrollments.length)
            : 0;
        return {
            coursesEnrolled,
            lessonsCompleted,
            totalProgress,
        };
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserService);
//# sourceMappingURL=user.service.js.map