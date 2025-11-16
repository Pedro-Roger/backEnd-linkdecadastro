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
exports.AdminUploadController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
let AdminUploadController = class AdminUploadController {
    getUploadPath() {
        const baseDir = process.env.UPLOAD_DIR || (0, path_1.join)(process.cwd(), 'public', 'uploads', 'banners');
        if (!(0, fs_1.existsSync)(baseDir)) {
            (0, fs_1.mkdirSync)(baseDir, { recursive: true });
        }
        return baseDir;
    }
    async uploadBanner(file, req) {
        if (!req.user || req.user.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Não autorizado');
        }
        if (!file) {
            throw new common_1.BadRequestException('Nenhum arquivo enviado');
        }
        const relativePath = `/uploads/banners/${file.filename}`;
        return {
            url: relativePath,
            filename: file.filename,
        };
    }
};
exports.AdminUploadController = AdminUploadController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, file, cb) => {
                const controller = new AdminUploadController();
                const uploadPath = controller.getUploadPath();
                cb(null, uploadPath);
            },
            filename: (_req, file, cb) => {
                const timestamp = Date.now();
                const randomString = Math.random().toString(36).substring(2, 15);
                const fileExtName = (0, path_1.extname)(file.originalname) || '.jpg';
                const filename = `banner-${timestamp}-${randomString}${fileExtName}`;
                cb(null, filename);
            },
        }),
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype.startsWith('image/')) {
                return cb(null, false);
            }
            cb(null, true);
        },
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminUploadController.prototype, "uploadBanner", null);
exports.AdminUploadController = AdminUploadController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('admin/upload')
], AdminUploadController);
//# sourceMappingURL=admin-upload.controller.js.map