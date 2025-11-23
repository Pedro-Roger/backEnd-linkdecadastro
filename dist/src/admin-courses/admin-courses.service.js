"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCoursesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const XLSX = __importStar(require("xlsx"));
const pdfkit_1 = __importDefault(require("pdfkit"));
let AdminCoursesService = class AdminCoursesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    assertAdmin(role) {
        if (role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Não autorizado');
        }
    }
    async listCourses(userRole) {
        this.assertAdmin(userRole);
        return this.prisma.course.findMany({
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
                        order: true,
                    },
                },
                regionQuotas: true,
                _count: {
                    select: {
                        enrollments: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getCourseById(courseId, userId, userRole) {
        this.assertAdmin(userRole);
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
                regionQuotas: true,
                _count: {
                    select: {
                        enrollments: true,
                    },
                },
            },
        });
        if (!course) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        return course;
    }
    extractYouTubeId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }
    async createCourse(userId, userRole, body) {
        this.assertAdmin(userRole);
        const { title, description, bannerUrl, status, type, maxEnrollments, waitlistEnabled, waitlistLimit, regionRestrictionEnabled, allowAllRegions, defaultRegionLimit, regionQuotas, startDate, endDate, slug, firstLesson, } = body;
        let normalizedSlug = null;
        if (slug !== undefined && slug !== null) {
            const slugStr = String(slug).trim();
            if (slugStr.length > 0) {
                normalizedSlug = slugStr.toLowerCase();
                if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
                    throw new common_1.ForbiddenException('URL personalizada deve conter apenas letras minúsculas, números e hífens');
                }
                const existingCourse = await this.prisma.course.findFirst({
                    where: { slug: normalizedSlug },
                });
                if (existingCourse) {
                    throw new common_1.ForbiddenException('URL personalizada já está em uso');
                }
            }
        }
        let finalBannerUrl = null;
        if (!bannerUrl || !bannerUrl.trim()) {
            if (firstLesson?.videoUrl) {
                const youtubeId = this.extractYouTubeId(firstLesson.videoUrl);
                if (youtubeId) {
                    finalBannerUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
                }
            }
        }
        else {
            finalBannerUrl = bannerUrl.trim();
        }
        const courseData = {
            title,
            description: description || null,
            bannerUrl: finalBannerUrl,
            status: status ?? 'ACTIVE',
            type: type ?? 'ONLINE',
            maxEnrollments: maxEnrollments || null,
            waitlistEnabled: waitlistEnabled ?? false,
            waitlistLimit: waitlistLimit ?? 0,
            regionRestrictionEnabled: regionRestrictionEnabled ?? false,
            allowAllRegions: allowAllRegions ?? true,
            defaultRegionLimit: defaultRegionLimit !== undefined ? defaultRegionLimit : null,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            createdBy: userId,
        };
        courseData.slug = normalizedSlug;
        const normalizedRegionQuotas = regionQuotas?.map((quota) => ({
            state: quota.state.trim().toUpperCase(),
            city: quota.city ? quota.city.trim() : null,
            limit: quota.limit,
            waitlistLimit: quota.waitlistLimit ?? 0,
        })) ?? [];
        const course = await this.prisma.$transaction(async (tx) => {
            const newCourse = await tx.course.create({
                data: courseData,
            });
            if (normalizedRegionQuotas.length > 0) {
                await tx.courseRegionQuota.createMany({
                    data: normalizedRegionQuotas.map((quota) => ({
                        courseId: newCourse.id,
                        state: quota.state,
                        city: quota.city,
                        limit: quota.limit,
                        waitlistLimit: quota.waitlistLimit,
                    })),
                });
            }
            if (firstLesson) {
                const youtubeId = this.extractYouTubeId(firstLesson.videoUrl);
                if (!youtubeId) {
                    throw new Error('URL do YouTube inválida');
                }
                const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
                await tx.lesson.create({
                    data: {
                        courseId: newCourse.id,
                        title: firstLesson.title,
                        description: firstLesson.description || null,
                        videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
                        bannerUrl: thumbnailUrl,
                        order: firstLesson.order || 0,
                    },
                });
            }
            return tx.course.findUnique({
                where: { id: newCourse.id },
                include: {
                    creator: {
                        select: {
                            name: true,
                            email: true,
                        },
                    },
                    lessons: {
                        orderBy: { order: 'asc' },
                    },
                    regionQuotas: true,
                    _count: {
                        select: {
                            enrollments: true,
                        },
                    },
                },
            });
        });
        if (!course) {
            throw new Error('Falha ao carregar curso recém-criado');
        }
        return course;
    }
    async deleteCourse(courseId, userId, userRole) {
        this.assertAdmin(userRole);
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });
        if (!course) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        await this.prisma.course.delete({
            where: { id: courseId },
        });
    }
    async updateCourse(courseId, userId, userRole, body) {
        this.assertAdmin(userRole);
        const existingCourse = await this.prisma.course.findUnique({
            where: { id: courseId },
        });
        if (!existingCourse) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        const { title, description, bannerUrl, status, type, maxEnrollments, waitlistEnabled, waitlistLimit, regionRestrictionEnabled, allowAllRegions, defaultRegionLimit, regionQuotas, startDate, endDate, slug, } = body;
        let finalBannerUrl = undefined;
        if (bannerUrl !== undefined) {
            if (bannerUrl && bannerUrl.trim()) {
                finalBannerUrl = bannerUrl.trim();
            }
            else {
                finalBannerUrl = null;
            }
        }
        const normalizedRegionQuotas = regionQuotas
            ? regionQuotas.map((quota) => ({
                id: quota.id ?? null,
                state: quota.state.trim().toUpperCase(),
                city: quota.city ? quota.city.trim() : null,
                limit: quota.limit,
                waitlistLimit: quota.waitlistLimit ?? 0,
            }))
            : null;
        const updateData = {};
        if (title !== undefined)
            updateData.title = title;
        if (description !== undefined)
            updateData.description = description || null;
        if (finalBannerUrl !== undefined)
            updateData.bannerUrl = finalBannerUrl;
        if (status !== undefined)
            updateData.status = status;
        if (type !== undefined)
            updateData.type = type;
        if (maxEnrollments !== undefined)
            updateData.maxEnrollments = maxEnrollments || null;
        if (waitlistEnabled !== undefined)
            updateData.waitlistEnabled = waitlistEnabled;
        if (waitlistLimit !== undefined)
            updateData.waitlistLimit = waitlistLimit;
        if (regionRestrictionEnabled !== undefined)
            updateData.regionRestrictionEnabled = regionRestrictionEnabled;
        if (allowAllRegions !== undefined)
            updateData.allowAllRegions = allowAllRegions;
        if (defaultRegionLimit !== undefined)
            updateData.defaultRegionLimit = defaultRegionLimit ?? null;
        if (startDate !== undefined)
            updateData.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined)
            updateData.endDate = endDate ? new Date(endDate) : null;
        if (slug !== undefined) {
            updateData.slug =
                slug && slug.trim() ? slug.trim().toLowerCase() : null;
        }
        const updatedCourse = await this.prisma.$transaction(async (tx) => {
            await tx.course.update({
                where: { id: courseId },
                data: updateData,
            });
            if (normalizedRegionQuotas) {
                const existingQuotas = await tx.courseRegionQuota.findMany({
                    where: { courseId },
                });
                const payloadIds = normalizedRegionQuotas
                    .map((quota) => quota.id)
                    .filter((id) => !!id);
                const quotasToDelete = existingQuotas
                    .filter((quota) => !payloadIds.includes(quota.id))
                    .map((quota) => quota.id);
                if (quotasToDelete.length > 0) {
                    await tx.courseRegionQuota.deleteMany({
                        where: { id: { in: quotasToDelete } },
                    });
                }
                for (const quota of normalizedRegionQuotas) {
                    if (quota.id) {
                        await tx.courseRegionQuota.update({
                            where: { id: quota.id },
                            data: {
                                state: quota.state,
                                city: quota.city,
                                limit: quota.limit,
                                waitlistLimit: quota.waitlistLimit,
                            },
                        });
                    }
                    else {
                        await tx.courseRegionQuota.create({
                            data: {
                                courseId,
                                state: quota.state,
                                city: quota.city,
                                limit: quota.limit,
                                waitlistLimit: quota.waitlistLimit,
                            },
                        });
                    }
                }
            }
            return tx.course.findUnique({
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
                    },
                    regionQuotas: true,
                    _count: {
                        select: {
                            enrollments: true,
                        },
                    },
                },
            });
        });
        if (!updatedCourse) {
            throw new common_1.NotFoundException('Curso não encontrado após atualização');
        }
        return updatedCourse;
    }
    async listLessons(courseId, userRole) {
        this.assertAdmin(userRole);
        return this.prisma.lesson.findMany({
            where: { courseId },
            orderBy: { order: 'asc' },
            include: {
                _count: {
                    select: {
                        comments: true,
                        progress: true,
                    },
                },
            },
        });
    }
    async createLesson(courseId, userId, userRole, body) {
        this.assertAdmin(userRole);
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });
        if (!course) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        const youtubeId = this.extractYouTubeId(body.videoUrl);
        if (!youtubeId) {
            throw new common_1.ForbiddenException('URL do YouTube inválida');
        }
        let finalBannerUrl = body.bannerUrl && body.bannerUrl.trim() ? body.bannerUrl.trim() : null;
        if (!finalBannerUrl) {
            finalBannerUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        }
        const lesson = await this.prisma.lesson.create({
            data: {
                title: body.title,
                description: body.description || null,
                videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
                bannerUrl: finalBannerUrl,
                duration: body.duration || null,
                order: body.order,
                courseId,
            },
        });
        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId },
            select: { userId: true },
        });
        if (enrollments.length > 0) {
            await this.prisma.notification.createMany({
                data: enrollments.map((enrollment) => ({
                    userId: enrollment.userId,
                    type: 'COURSE_UPDATED',
                    title: 'Nova aula disponível',
                    message: `Uma nova aula foi adicionada ao curso "${course.title}": ${body.title}`,
                    link: `/course/${courseId}`,
                })),
            });
        }
        return lesson;
    }
    async getLesson(courseId, lessonId, userId, userRole) {
        this.assertAdmin(userRole);
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        createdBy: true,
                    },
                },
            },
        });
        if (!lesson || lesson.courseId !== courseId) {
            throw new common_1.NotFoundException('Aula não encontrada');
        }
        return lesson;
    }
    async updateLesson(courseId, lessonId, userId, userRole, body) {
        this.assertAdmin(userRole);
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        createdBy: true,
                    },
                },
            },
        });
        if (!lesson || lesson.courseId !== courseId) {
            throw new common_1.NotFoundException('Aula não encontrada');
        }
        const youtubeId = this.extractYouTubeId(body.videoUrl);
        if (!youtubeId) {
            throw new common_1.ForbiddenException('URL do YouTube inválida');
        }
        let finalBannerUrl = body.bannerUrl && body.bannerUrl.trim() ? body.bannerUrl.trim() : null;
        if (!finalBannerUrl) {
            finalBannerUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
        }
        const updatedLesson = await this.prisma.lesson.update({
            where: { id: lessonId },
            data: {
                title: body.title,
                description: body.description || null,
                videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
                bannerUrl: finalBannerUrl,
                duration: body.duration || null,
                order: body.order,
            },
        });
        return updatedLesson;
    }
    async deleteLesson(courseId, lessonId, userId, userRole) {
        this.assertAdmin(userRole);
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                course: {
                    select: {
                        id: true,
                        createdBy: true,
                    },
                },
            },
        });
        if (!lesson || lesson.courseId !== courseId) {
            throw new common_1.NotFoundException('Aula não encontrada');
        }
        await this.prisma.lesson.delete({
            where: { id: lessonId },
        });
    }
    async listEnrollments(courseId, userRole) {
        this.assertAdmin(userRole);
        console.log('[listEnrollments] Buscando inscrições para o curso:', courseId);
        try {
            const enrollmentsData = await this.prisma.enrollment.findMany({
                where: { courseId },
                include: {
                    course: {
                        select: {
                            title: true,
                            waitlistEnabled: true,
                            waitlistLimit: true,
                            maxEnrollments: true,
                        },
                    },
                    regionQuota: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            const userIds = enrollmentsData.map((e) => e.userId).filter(Boolean);
            const users = await this.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    createdAt: true,
                    state: true,
                    city: true,
                    phone: true,
                },
            });
            const userMap = new Map(users.map((u) => [u.id, u]));
            const enrollments = enrollmentsData
                .map((enrollment) => {
                const user = userMap.get(enrollment.userId);
                if (!user) {
                    return null;
                }
                return {
                    ...enrollment,
                    user,
                };
            })
                .filter((e) => e !== null);
            console.log('[listEnrollments] Inscrições encontradas:', enrollments.length);
            if (enrollmentsData.length !== enrollments.length) {
                console.warn(`[listEnrollments] ${enrollmentsData.length - enrollments.length} inscrições sem usuário foram filtradas`);
            }
            return enrollments;
        }
        catch (error) {
            console.error('[listEnrollments] Erro ao buscar inscrições:', error);
            throw error;
        }
    }
    statusLabels = {
        CONFIRMED: 'Confirmada',
        WAITLIST: 'Lista de Espera',
        PENDING_REGION: 'Pendente',
        REJECTED: 'Rejeitada',
    };
    async exportEnrollments(courseId, userRole, formatParam, fieldsParam) {
        this.assertAdmin(userRole);
        console.log('[exportEnrollments] Iniciando exportação:', { courseId, formatParam, fieldsParam });
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: {
                title: true,
            },
        });
        if (!course) {
            console.error('[exportEnrollments] Curso não encontrado:', courseId);
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        console.log('[exportEnrollments] Curso encontrado:', course.title);
        let enrollments = [];
        try {
            const enrollmentsData = await this.prisma.enrollment.findMany({
                where: { courseId },
                include: {
                    regionQuota: {
                        select: {
                            state: true,
                            city: true,
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            });
            const userIds = enrollmentsData.map((e) => e.userId).filter(Boolean);
            const users = await this.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    createdAt: true,
                    phone: true,
                    state: true,
                    city: true,
                },
            });
            const userMap = new Map(users.map((u) => [u.id, u]));
            enrollments = enrollmentsData
                .map((enrollment) => {
                const user = userMap.get(enrollment.userId);
                if (!user) {
                    return null;
                }
                return {
                    ...enrollment,
                    user,
                };
            })
                .filter((e) => e !== null);
            console.log('[exportEnrollments] Inscrições encontradas para exportação:', enrollments.length);
            if (enrollmentsData.length !== enrollments.length) {
                console.warn(`[exportEnrollments] ${enrollmentsData.length - enrollments.length} inscrições sem usuário foram filtradas`);
            }
        }
        catch (error) {
            console.error('[exportEnrollments] Erro ao buscar inscrições:', error);
            throw error;
        }
        const availableFields = {
            number: {
                label: 'Nº',
                getter: (_e) => 0,
            },
            name: {
                label: 'Nome',
                getter: (e) => e.user.name,
            },
            email: {
                label: 'Email',
                getter: (e) => e.user.email,
            },
            whatsapp: {
                label: 'WhatsApp',
                getter: (e) => e.whatsappNumber || e.user.phone || '-',
            },
            status: {
                label: 'Status',
                getter: (e) => this.statusLabels[e.status] || e.status,
            },
            progress: {
                label: 'Progresso (%)',
                getter: (e) => e.progress ?? 0,
            },
            participantType: {
                label: 'Tipo de Participante',
                getter: (e) => e.participantType || '-',
            },
            cpf: {
                label: 'CPF',
                getter: (e) => e.cpf || '-',
            },
            state: {
                label: 'Estado',
                getter: (e) => e.state || e.user.state || '-',
            },
            city: {
                label: 'Cidade',
                getter: (e) => e.city || e.user.city || '-',
            },
            region: {
                label: 'Região do Curso',
                getter: (e) => {
                    if (e.regionQuota) {
                        return e.regionQuota.city
                            ? `${e.regionQuota.state} - ${e.regionQuota.city}`
                            : e.regionQuota.state;
                    }
                    return '-';
                },
            },
            eligible: {
                label: 'Elegível para Região',
                getter: (e) => {
                    if (e.status === 'PENDING_REGION') {
                        return 'Não';
                    }
                    if (e.regionQuota) {
                        return 'Sim';
                    }
                    return e.status === 'CONFIRMED' ? 'Sim' : 'Não';
                },
            },
            createdAt: {
                label: 'Data de Inscrição',
                getter: (e) => new Date(e.createdAt).toLocaleString(),
            },
            completedAt: {
                label: 'Data de Conclusão',
                getter: (e) => e.completedAt
                    ? new Date(e.completedAt).toLocaleString()
                    : '-',
            },
            waitlistPosition: {
                label: 'Posição na Lista de Espera',
                getter: (e) => e.waitlistPosition ?? '-',
            },
            eligibilityReason: {
                label: 'Observações',
                getter: (e) => e.eligibilityReason || '-',
            },
        };
        const defaultFields = [
            'number',
            'name',
            'email',
            'whatsapp',
            'status',
            'region',
            'eligible',
            'progress',
            'createdAt',
        ];
        function parseFields(fields) {
            if (!fields || fields.length === 0) {
                return [...defaultFields];
            }
            const parsed = fields
                .map((field) => field.trim())
                .filter((field) => field in availableFields);
            return parsed.length > 0 ? parsed : [...defaultFields];
        }
        const selectedFields = parseFields(fieldsParam);
        const headerRow = selectedFields.map((key) => availableFields[key].label);
        const dataRows = enrollments.map((enrollment, index) => selectedFields.map((key) => {
            const value = key === 'number'
                ? index + 1
                : availableFields[key].getter(enrollment);
            return value === null || value === undefined ? '' : value;
        }));
        const sanitizedTitle = course.title
            .replace(/[^a-z0-9]/gi, '-')
            .toLowerCase();
        const formatType = formatParam === 'csv' || formatParam === 'pdf' ? formatParam : 'xlsx';
        if (formatType === 'pdf') {
            const doc = new pdfkit_1.default({ size: 'A4', margin: 40 });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            const pdfPromise = new Promise((resolve) => {
                doc.on('end', () => resolve(Buffer.concat(chunks)));
            });
            doc.fontSize(16).text(`Relatório de Inscrições - ${course.title}`);
            doc.moveDown();
            if (enrollments.length === 0) {
                doc.fontSize(12).text('Nenhum inscrito encontrado.');
            }
            else {
                enrollments.forEach((enrollment, index) => {
                    doc.fontSize(12).font('Helvetica-Bold').text(`Participante ${index + 1}`);
                    doc.moveDown(0.2);
                    selectedFields.forEach((fieldKey) => {
                        if (fieldKey === 'number')
                            return;
                        const descriptor = availableFields[fieldKey];
                        const value = descriptor.getter(enrollment);
                        doc
                            .font('Helvetica')
                            .fontSize(11)
                            .text(`${descriptor.label}: ${value ?? '-'}`);
                    });
                    doc.moveDown();
                });
            }
            doc.end();
            const pdfBuffer = await pdfPromise;
            return {
                buffer: pdfBuffer,
                contentType: 'application/pdf',
                filename: `inscritos-${sanitizedTitle}.pdf`,
            };
        }
        const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscritos');
        if (formatType === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
            const csvBuffer = Buffer.from(csv, 'utf-8');
            return {
                buffer: csvBuffer,
                contentType: 'text/csv; charset=utf-8',
                filename: `inscritos-${sanitizedTitle}.csv`,
            };
        }
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return {
            buffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: `inscritos-${sanitizedTitle}.xlsx`,
        };
    }
    async listCourseClasses(courseId, userRole) {
        this.assertAdmin(userRole);
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                title: true,
                maxEnrollments: true,
            },
        });
        if (!course) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        const classes = await this.prisma.courseClass.findMany({
            where: { courseId },
            orderBy: { classNumber: 'asc' },
            include: {
                _count: {
                    select: { enrollments: true },
                },
            },
        });
        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId },
            select: {
                courseClassId: true,
                status: true,
            },
        });
        const classesWithCounts = classes.map((classItem) => {
            const confirmedCount = enrollments.filter((e) => e.courseClassId === classItem.id &&
                e.status === client_1.EnrollmentStatus.CONFIRMED).length;
            return {
                id: classItem.id,
                classNumber: classItem.classNumber,
                limit: classItem.limit,
                currentCount: confirmedCount,
                status: classItem.status,
                createdAt: classItem.createdAt,
                closedAt: classItem.closedAt,
                totalEnrollments: classItem._count.enrollments,
            };
        });
        const activeClass = classes.find((c) => c.status === client_1.CourseClassStatus.ACTIVE);
        return {
            course: {
                id: course.id,
                title: course.title,
                maxEnrollments: course.maxEnrollments,
            },
            classes: classesWithCounts,
            activeClassNumber: activeClass?.classNumber ?? null,
            activeClassLimit: activeClass?.limit ?? null,
            activeClassCount: activeClass
                ? enrollments.filter((e) => e.courseClassId === activeClass.id &&
                    e.status === client_1.EnrollmentStatus.CONFIRMED).length
                : null,
        };
    }
    async createCourseClass(courseId, userRole, body) {
        this.assertAdmin(userRole);
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });
        if (!course) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        const lastClass = await this.prisma.courseClass.findFirst({
            where: { courseId },
            orderBy: { classNumber: 'desc' },
        });
        const nextClassNumber = lastClass ? lastClass.classNumber + 1 : 1;
        const limit = body.limit || course.maxEnrollments || 50;
        return this.prisma.courseClass.create({
            data: {
                courseId,
                classNumber: nextClassNumber,
                limit,
                currentCount: 0,
                status: client_1.CourseClassStatus.ACTIVE,
            },
        });
    }
    async closeCourseClass(classId, userRole) {
        this.assertAdmin(userRole);
        const classItem = await this.prisma.courseClass.findUnique({
            where: { id: classId },
        });
        if (!classItem) {
            throw new common_1.NotFoundException('Turma não encontrada');
        }
        if (classItem.status === client_1.CourseClassStatus.CLOSED) {
            throw new common_1.ForbiddenException('Turma já está encerrada');
        }
        return this.prisma.courseClass.update({
            where: { id: classId },
            data: {
                status: client_1.CourseClassStatus.CLOSED,
                closedAt: new Date(),
            },
        });
    }
};
exports.AdminCoursesService = AdminCoursesService;
exports.AdminCoursesService = AdminCoursesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminCoursesService);
//# sourceMappingURL=admin-courses.service.js.map