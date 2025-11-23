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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareController = void 0;
const common_1 = require("@nestjs/common");
const share_service_1 = require("./share.service");
let ShareController = class ShareController {
    shareService;
    constructor(shareService) {
        this.shareService = shareService;
    }
    async getCourseShare(courseId, res) {
        try {
            const course = await this.shareService.getCoursePreviewData(courseId);
            const frontendUrl = process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
            const siteUrl = frontendUrl.replace(/\/$/, '');
            const url = course.slug
                ? `${siteUrl}/c/${course.slug}`
                : `${siteUrl}/course/${course.id}`;
            const html = this.shareService.generateOpenGraphHTML({
                title: course.title,
                description: course.description,
                bannerUrl: course.bannerUrl,
                url,
                type: 'article',
            });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.NotFoundException('Curso não encontrado');
        }
    }
    async getEventShare(eventId, res) {
        try {
            const event = await this.shareService.getEventPreviewData(eventId);
            const frontendUrl = process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
            const siteUrl = frontendUrl.replace(/\/$/, '');
            const url = `${siteUrl}/register/${event.linkId}`;
            const html = this.shareService.generateOpenGraphHTML({
                title: event.title,
                description: event.description,
                bannerUrl: event.bannerUrl,
                url,
                type: 'article',
            });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.NotFoundException('Evento não encontrado');
        }
    }
    async getEnrollShare(courseSlugOrId, res) {
        try {
            console.log('[getEnrollShare] Recebido:', courseSlugOrId);
            const decodedParam = decodeURIComponent(courseSlugOrId);
            console.log('[getEnrollShare] Parâmetro decodificado:', decodedParam);
            const course = await this.shareService.getCoursePreviewData(decodedParam);
            const frontendUrl = process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
            const siteUrl = frontendUrl.replace(/\/$/, '');
            const url = course.slug
                ? `${siteUrl}/enroll.html?course=${encodeURIComponent(course.slug)}`
                : `${siteUrl}/enroll.html?course=${course.id}`;
            console.log('[getEnrollShare] URL gerada:', url);
            const html = this.shareService.generateOpenGraphHTML({
                title: course.title,
                description: course.description,
                bannerUrl: course.bannerUrl,
                url,
                type: 'website',
            });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        }
        catch (error) {
            console.error('[getEnrollShare] Erro:', error);
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.NotFoundException('Curso não encontrado');
        }
    }
};
exports.ShareController = ShareController;
__decorate([
    (0, common_1.Get)('course/:courseId'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "getCourseShare", null);
__decorate([
    (0, common_1.Get)('event/:eventId'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "getEventShare", null);
__decorate([
    (0, common_1.Get)('enroll/:courseSlugOrId'),
    __param(0, (0, common_1.Param)('courseSlugOrId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "getEnrollShare", null);
exports.ShareController = ShareController = __decorate([
    (0, common_1.Controller)('share'),
    __metadata("design:paramtypes", [share_service_1.ShareService])
], ShareController);
//# sourceMappingURL=share.controller.js.map