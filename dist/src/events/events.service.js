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
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let EventsService = class EventsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listEvents(userRole) {
        if (!userRole) {
            throw new common_1.ForbiddenException('Não autorizado');
        }
        return this.prisma.event.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { registrations: true },
                },
            },
        });
    }
    async createEvent(userId, userRole, body) {
        if (!userRole || userRole !== 'ADMIN') {
            throw new common_1.ForbiddenException('Não autorizado');
        }
        const { title, description, bannerUrl, maxRegistrations, slug } = body;
        let normalizedSlug = null;
        if (slug && typeof slug === 'string' && slug.trim()) {
            normalizedSlug = slug.trim().toLowerCase();
            if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
                throw new common_1.ForbiddenException('Slug inválido. Use apenas letras minúsculas, números e hífens.');
            }
        }
        else {
            normalizedSlug = null;
        }
        const linkId = `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        return this.prisma.event.create({
            data: {
                title,
                description,
                bannerUrl,
                maxRegistrations,
                slug: normalizedSlug || undefined,
                linkId,
                createdBy: userId,
                status: 'ACTIVE',
            },
        });
    }
    async getEventByLink(linkId) {
        const event = await this.prisma.event.findUnique({
            where: { linkId },
            include: {
                _count: {
                    select: { registrations: true },
                },
            },
        });
        if (!event) {
            throw new common_1.NotFoundException('Evento não encontrado');
        }
        if (event.status !== 'ACTIVE') {
            throw new common_1.ForbiddenException('Evento não está ativo');
        }
        return event;
    }
    async getEventBySlug(slug) {
        const normalizedSlug = slug.toLowerCase().trim();
        const event = await this.prisma.event.findUnique({
            where: { slug: normalizedSlug },
            include: {
                _count: {
                    select: { registrations: true },
                },
            },
        });
        if (!event) {
            throw new common_1.NotFoundException('Evento não encontrado');
        }
        if (event.status !== 'ACTIVE') {
            throw new common_1.ForbiddenException('Evento não está ativo');
        }
        return event;
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EventsService);
//# sourceMappingURL=events.service.js.map