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
exports.CoursesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let CoursesService = class CoursesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listCourses(filter) {
        const now = new Date();
        let whereClause = { status: 'ACTIVE' };
        if (filter === 'available') {
            whereClause = {
                status: 'ACTIVE',
                OR: [
                    { startDate: null },
                    { startDate: { gte: now } },
                    {
                        startDate: { lte: now },
                        OR: [{ endDate: null }, { endDate: { gte: now } }],
                    },
                ],
            };
        }
        else if (filter === 'ongoing') {
            whereClause = {
                status: 'ACTIVE',
                AND: [
                    {
                        OR: [{ startDate: null }, { startDate: { lte: now } }],
                    },
                    {
                        OR: [{ endDate: null }, { endDate: { gte: now } }],
                    },
                ],
            };
        }
        return this.prisma.course.findMany({
            where: whereClause,
            select: {
                id: true,
                title: true,
                description: true,
                bannerUrl: true,
                status: true,
                type: true,
                maxEnrollments: true,
                waitlistEnabled: true,
                waitlistLimit: true,
                regionRestrictionEnabled: true,
                allowAllRegions: true,
                startDate: true,
                endDate: true,
                slug: true,
                createdAt: true,
                updatedAt: true,
                createdBy: true,
                creator: {
                    select: {
                        name: true,
                    },
                },
                lessons: {
                    orderBy: { order: 'asc' },
                    select: {
                        id: true,
                        title: true,
                        order: true,
                    },
                },
                _count: {
                    select: {
                        enrollments: true,
                        lessons: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async listMyCourses(userId) {
        const enrollments = await this.prisma.enrollment.findMany({
            where: { userId },
            include: {
                course: {
                    include: {
                        lessons: {
                            orderBy: { order: 'asc' },
                            select: {
                                id: true,
                                title: true,
                                order: true,
                            },
                        },
                        _count: {
                            select: {
                                lessons: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const coursesWithProgress = await Promise.all(enrollments.map(async (enrollment) => {
            const completedLessons = await this.prisma.lessonProgress.count({
                where: {
                    userId,
                    completed: true,
                    lesson: {
                        courseId: enrollment.courseId,
                    },
                },
            });
            return {
                ...enrollment.course,
                progress: enrollment.progress,
                completedLessons,
                totalLessons: enrollment.course._count.lessons,
            };
        }));
        return coursesWithProgress;
    }
    async getCourseById(courseId, userId) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                creator: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                lessons: {
                    orderBy: { order: 'asc' },
                    include: {
                        _count: {
                            select: {
                                comments: true,
                            },
                        },
                    },
                },
                regionQuotas: true,
            },
        });
        if (!course) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        if (!userId) {
            return course;
        }
        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
            include: {
                course: {
                    include: {
                        lessons: {
                            include: {
                                progress: {
                                    where: {
                                        userId,
                                    },
                                },
                            },
                        },
                        regionQuotas: true,
                    },
                },
            },
        });
        if (enrollment) {
            return {
                ...course,
                enrollment,
                progress: enrollment.progress,
            };
        }
        return course;
    }
    async getCourseBySlug(slug) {
        const course = await this.prisma.course.findFirst({
            where: { slug },
            include: {
                creator: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                lessons: {
                    orderBy: { order: 'asc' },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        videoUrl: true,
                        bannerUrl: true,
                        duration: true,
                        order: true,
                    },
                },
                _count: {
                    select: {
                        enrollments: true,
                        lessons: true,
                    },
                },
            },
        });
        if (!course) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        if (course.status !== 'ACTIVE') {
            throw new common_1.NotFoundException('Curso não está disponível');
        }
        return course;
    }
    async checkEnrollment(userId, courseId) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
        });
        return {
            enrolled: !!enrollment,
            status: enrollment?.status ?? null,
            waitlistPosition: enrollment?.waitlistPosition ?? null,
            eligibilityReason: enrollment?.eligibilityReason ?? null,
        };
    }
    async enrollInCourse(userId, courseId, body) {
        const { cpf, birthDate, participantType, hectares, state, city, whatsappNumber, } = body;
        if (!whatsappNumber || typeof whatsappNumber !== 'string') {
            return {
                error: {
                    message: 'Número de WhatsApp é obrigatório',
                    status: 400,
                },
            };
        }
        const formattedState = state?.toString().trim() || null;
        const formattedCity = city?.toString().trim() || null;
        const result = await this.prisma.$transaction(async (tx) => {
            const course = await tx.course.findUnique({
                where: { id: courseId },
                include: {
                    regionQuotas: true,
                },
            });
            if (!course || course.status !== 'ACTIVE') {
                return {
                    error: {
                        message: 'Curso não encontrado ou inativo',
                        status: 404,
                    },
                };
            }
            const existingEnrollment = await tx.enrollment.findUnique({
                where: {
                    userId_courseId: {
                        userId,
                        courseId,
                    },
                },
            });
            if (existingEnrollment) {
                return {
                    error: {
                        message: 'Você já possui uma inscrição para este curso',
                        status: 409,
                    },
                };
            }
            const confirmedCount = await tx.enrollment.count({
                where: {
                    courseId,
                    status: client_1.EnrollmentStatus.CONFIRMED,
                },
            });
            const waitlistCount = await tx.enrollment.count({
                where: {
                    courseId,
                    status: client_1.EnrollmentStatus.WAITLIST,
                },
            });
            const regionQuota = course.regionQuotas.find((quota) => {
                if (!formattedState)
                    return false;
                const sameState = quota.state.toLowerCase() === formattedState.toLowerCase();
                if (!sameState)
                    return false;
                if (!quota.city) {
                    return true;
                }
                if (!formattedCity)
                    return false;
                return quota.city.toLowerCase() === formattedCity.toLowerCase();
            });
            let regionConfirmedCount = 0;
            let regionWaitlistCount = 0;
            if (regionQuota) {
                regionConfirmedCount = await tx.enrollment.count({
                    where: {
                        courseId,
                        status: client_1.EnrollmentStatus.CONFIRMED,
                        regionQuotaId: regionQuota.id,
                    },
                });
                regionWaitlistCount = await tx.enrollment.count({
                    where: {
                        courseId,
                        status: client_1.EnrollmentStatus.WAITLIST,
                        regionQuotaId: regionQuota.id,
                    },
                });
            }
            const courseIsFull = !!course.maxEnrollments && confirmedCount >= course.maxEnrollments;
            const regionIsFull = !!regionQuota && regionConfirmedCount >= regionQuota.limit;
            const waitlistAvailable = course.waitlistEnabled &&
                (!course.waitlistLimit || waitlistCount < course.waitlistLimit);
            const regionWaitlistAvailable = !!regionQuota &&
                regionQuota.waitlistLimit > 0 &&
                regionWaitlistCount < regionQuota.waitlistLimit;
            let enrollmentStatus = client_1.EnrollmentStatus.CONFIRMED;
            let eligibilityReason = null;
            let waitlistPosition = null;
            let regionQuotaId = regionQuota ? regionQuota.id : null;
            if (course.regionRestrictionEnabled) {
                if (!regionQuota) {
                    if (course.allowAllRegions) {
                        enrollmentStatus = client_1.EnrollmentStatus.PENDING_REGION;
                        eligibilityReason = 'Participante fora das regiões prioritárias';
                        regionQuotaId = null;
                    }
                    else {
                        enrollmentStatus = client_1.EnrollmentStatus.PENDING_REGION;
                        eligibilityReason = 'Região não elegível para este curso';
                        regionQuotaId = null;
                    }
                }
            }
            if (enrollmentStatus === client_1.EnrollmentStatus.CONFIRMED &&
                (courseIsFull || regionIsFull)) {
                if (waitlistAvailable) {
                    enrollmentStatus = client_1.EnrollmentStatus.WAITLIST;
                    waitlistPosition = waitlistCount + 1;
                    if (regionQuota && regionIsFull && regionWaitlistAvailable) {
                        waitlistPosition = regionWaitlistCount + 1;
                    }
                }
                else {
                    enrollmentStatus = client_1.EnrollmentStatus.PENDING_REGION;
                    eligibilityReason = courseIsFull
                        ? 'Curso atingiu o limite de vagas'
                        : 'Limite regional atingido';
                }
            }
            const parsedHectares = participantType === 'PRODUTOR' && hectares
                ? parseFloat(hectares)
                : null;
            const enrollment = await tx.enrollment.create({
                data: {
                    userId,
                    courseId,
                    progress: 0,
                    cpf: cpf || null,
                    birthDate: birthDate ? new Date(birthDate) : null,
                    participantType: participantType || null,
                    hectares: parsedHectares,
                    state: formattedState,
                    city: formattedCity,
                    status: enrollmentStatus,
                    waitlistPosition,
                    regionQuotaId,
                    eligibilityReason,
                    whatsappNumber,
                },
                include: {
                    course: true,
                },
            });
            await tx.user.update({
                where: { id: userId },
                data: {
                    phone: whatsappNumber,
                    ...(formattedState ? { state: formattedState } : {}),
                    ...(formattedCity ? { city: formattedCity } : {}),
                },
            });
            if (regionQuota && enrollmentStatus === client_1.EnrollmentStatus.CONFIRMED) {
                await tx.courseRegionQuota.update({
                    where: { id: regionQuota.id },
                    data: {
                        currentCount: { increment: 1 },
                    },
                });
            }
            if (regionQuota && enrollmentStatus === client_1.EnrollmentStatus.WAITLIST) {
                await tx.courseRegionQuota.update({
                    where: { id: regionQuota.id },
                    data: {
                        waitlistCount: { increment: 1 },
                    },
                });
            }
            let notificationTitle = 'Inscrição confirmada!';
            let notificationMessage = `Você foi inscrito no curso "${course.title}"`;
            if (enrollmentStatus === client_1.EnrollmentStatus.WAITLIST) {
                notificationTitle = 'Inscrição em lista de espera';
                notificationMessage = `Você entrou na lista de espera do curso "${course.title}". Aguarde a confirmação do administrador.`;
            }
            else if (enrollmentStatus === client_1.EnrollmentStatus.PENDING_REGION) {
                notificationTitle = 'Inscrição pendente';
                notificationMessage = `Sua inscrição no curso "${course.title}" foi registrada, mas ainda não está elegível. Motivo: ${eligibilityReason}.`;
            }
            return {
                course,
                enrollment,
                metadata: {
                    courseIsFull,
                    waitlistAvailable,
                    regionQuota,
                    waitlistPosition,
                },
                notification: {
                    title: notificationTitle,
                    message: notificationMessage,
                },
            };
        });
        if ('error' in result && result.error) {
            return result;
        }
        const { enrollment, notification, metadata, course } = result;
        await this.prisma.notification.create({
            data: {
                userId,
                type: 'COURSE_ENROLLED',
                title: notification.title,
                message: notification.message,
                link: `/course/${courseId}`,
            },
        });
        return {
            enrollment,
            metadata: {
                isFull: metadata.courseIsFull,
                waitlistPosition: metadata.waitlistPosition,
                regionQuotaId: metadata.regionQuota?.id || null,
            },
            course: {
                id: course.id,
                title: course.title,
                waitlistEnabled: course.waitlistEnabled,
            },
        };
    }
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CoursesService);
//# sourceMappingURL=courses.service.js.map