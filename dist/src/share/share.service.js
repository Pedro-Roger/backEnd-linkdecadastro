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
exports.ShareService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ShareService = class ShareService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCoursePreviewData(courseIdOrSlug) {
        let decodedSlug;
        try {
            decodedSlug = decodeURIComponent(courseIdOrSlug);
        }
        catch (e) {
            decodedSlug = courseIdOrSlug;
        }
        const normalizedSlug = decodedSlug.toLowerCase().trim();
        let course = await this.prisma.course.findUnique({
            where: { slug: normalizedSlug },
            select: {
                id: true,
                title: true,
                description: true,
                bannerUrl: true,
                slug: true,
            },
        });
        if (!course) {
            if (/^[0-9a-fA-F]{24}$/.test(decodedSlug)) {
                course = await this.prisma.course.findUnique({
                    where: { id: decodedSlug },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        bannerUrl: true,
                        slug: true,
                    },
                });
            }
        }
        if (!course) {
            throw new common_1.NotFoundException('Curso não encontrado');
        }
        return course;
    }
    async getEventPreviewData(eventIdOrSlug) {
        let decodedSlug;
        try {
            decodedSlug = decodeURIComponent(eventIdOrSlug);
        }
        catch (e) {
            decodedSlug = eventIdOrSlug;
        }
        const normalizedSlug = decodedSlug.toLowerCase().trim();
        let event = await this.prisma.event.findUnique({
            where: { slug: normalizedSlug },
            select: {
                id: true,
                title: true,
                description: true,
                bannerUrl: true,
                linkId: true,
                slug: true,
            },
        });
        if (!event) {
            if (/^[0-9a-fA-F]{24}$/.test(decodedSlug)) {
                event = await this.prisma.event.findUnique({
                    where: { id: decodedSlug },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        bannerUrl: true,
                        linkId: true,
                        slug: true,
                    },
                });
            }
            else {
                event = await this.prisma.event.findUnique({
                    where: { linkId: decodedSlug },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        bannerUrl: true,
                        linkId: true,
                        slug: true,
                    },
                });
            }
        }
        if (!event) {
            throw new common_1.NotFoundException('Evento não encontrado');
        }
        return event;
    }
    generateOpenGraphHTML(data) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
        const siteUrl = frontendUrl.replace(/\/$/, '');
        let imageUrl = data.bannerUrl;
        if (imageUrl) {
            if (imageUrl.startsWith('/uploads/')) {
                const backendUrl = process.env.BACKEND_URL || 'https://backend-linkdecadastro.onrender.com';
                imageUrl = `${backendUrl}${imageUrl}`;
            }
            else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                const backendUrl = process.env.BACKEND_URL || 'https://backend-linkdecadastro.onrender.com';
                imageUrl = `${backendUrl}${imageUrl}`;
            }
        }
        else {
            imageUrl = `${siteUrl}/logo.png`;
        }
        const description = data.description
            ? data.description.replace(/<[^>]*>/g, '').substring(0, 200)
            : `${data.title} - Link de Cadastro`;
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${this.escapeHtml(data.title)}</title>
  <meta name="title" content="${this.escapeHtml(data.title)}">
  <meta name="description" content="${this.escapeHtml(description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${data.type || 'website'}">
  <meta property="og:url" content="${data.url}">
  <meta property="og:title" content="${this.escapeHtml(data.title)}">
  <meta property="og:description" content="${this.escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Link de Cadastro">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${data.url}">
  <meta property="twitter:title" content="${this.escapeHtml(data.title)}">
  <meta property="twitter:description" content="${this.escapeHtml(description)}">
  <meta property="twitter:image" content="${imageUrl}">

  <!-- WhatsApp -->
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:secure_url" content="${imageUrl}">
  
  <!-- Redirect to actual page -->
  <meta http-equiv="refresh" content="0; url=${data.url}">
  <script>
    window.location.href = "${data.url}";
  </script>
</head>
<body>
  <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    <h1>${this.escapeHtml(data.title)}</h1>
    <p>Redirecionando...</p>
    <p><a href="${data.url}">Clique aqui se não for redirecionado</a></p>
  </div>
</body>
</html>`;
    }
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
};
exports.ShareService = ShareService;
exports.ShareService = ShareService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ShareService);
//# sourceMappingURL=share.service.js.map