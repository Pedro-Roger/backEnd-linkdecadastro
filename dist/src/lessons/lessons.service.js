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
exports.LessonsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let LessonsService = class LessonsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getComments(lessonId) {
        return this.prisma.comment.findMany({
            where: { lessonId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async addComment(userId, lessonId, content) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: { course: true },
        });
        if (!lesson) {
            throw new common_1.NotFoundException('Aula não encontrada');
        }
        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId: lesson.courseId,
                },
            },
        });
        if (!enrollment) {
            throw new common_1.ForbiddenException('Você precisa estar inscrito no curso para comentar');
        }
        const comment = await this.prisma.comment.create({
            data: {
                userId,
                lessonId,
                content,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        email: true,
                    },
                },
            },
        });
        if (lesson.course.createdBy !== userId) {
            await this.prisma.notification.create({
                data: {
                    userId: lesson.course.createdBy,
                    type: 'NEW_COMMENT',
                    title: 'Novo comentário',
                    message: `${comment.user.name} comentou na aula "${lesson.title}"`,
                    link: `/course/${lesson.courseId}`,
                },
            });
        }
        return comment;
    }
    async updateProgress(userId, lessonId, data) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                course: true,
            },
        });
        if (!lesson) {
            throw new common_1.NotFoundException('Aula não encontrada');
        }
        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId: lesson.courseId,
                },
            },
        });
        if (!enrollment) {
            throw new common_1.ForbiddenException('Você não está inscrito neste curso');
        }
        const progress = await this.prisma.lessonProgress.upsert({
            where: {
                userId_lessonId: {
                    userId,
                    lessonId,
                },
            },
            update: {
                watchedTime: data.watchedTime,
                completed: data.completed,
                completedAt: data.completed ? new Date() : null,
            },
            create: {
                userId,
                lessonId,
                watchedTime: data.watchedTime,
                completed: data.completed,
                completedAt: data.completed ? new Date() : null,
            },
        });
        if (data.completed) {
            const totalLessons = await this.prisma.lesson.count({
                where: { courseId: lesson.courseId },
            });
            const completedLessons = await this.prisma.lessonProgress.count({
                where: {
                    userId,
                    completed: true,
                    lesson: {
                        courseId: lesson.courseId,
                    },
                },
            });
            const courseProgress = Math.round((completedLessons / totalLessons) * 100);
            await this.prisma.enrollment.update({
                where: {
                    userId_courseId: {
                        userId,
                        courseId: lesson.courseId,
                    },
                },
                data: {
                    progress: courseProgress,
                    completedAt: courseProgress === 100 ? new Date() : null,
                },
            });
            await this.prisma.notification.create({
                data: {
                    userId,
                    type: 'LESSON_COMPLETED',
                    title: 'Aula concluída!',
                    message: `Você concluiu a aula "${lesson.title}"`,
                    link: `/course/${lesson.courseId}`,
                },
            });
        }
        return progress;
    }
    async getProgress(userId, lessonId) {
        const progress = await this.prisma.lessonProgress.findUnique({
            where: {
                userId_lessonId: {
                    userId,
                    lessonId,
                },
            },
        });
        return progress || { completed: false, watchedTime: 0 };
    }
};
exports.LessonsService = LessonsService;
exports.LessonsService = LessonsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LessonsService);
//# sourceMappingURL=lessons.service.js.map