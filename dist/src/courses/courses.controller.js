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
exports.CoursesController = void 0;
const common_1 = require("@nestjs/common");
const courses_service_1 = require("./courses.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const jwt_1 = require("@nestjs/jwt");
let CoursesController = class CoursesController {
    coursesService;
    jwtService;
    constructor(coursesService, jwtService) {
        this.coursesService = coursesService;
        this.jwtService = jwtService;
    }
    async listCourses(filter) {
        return this.coursesService.listCourses(filter || undefined);
    }
    async listMyCourses(req) {
        return this.coursesService.listMyCourses(req.user.id);
    }
    async getBySlug(slug) {
        return this.coursesService.getCourseBySlug(slug);
    }
    async getCourse(courseId, req) {
        const authHeader = req.headers.authorization;
        let userId;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const payload = this.jwtService.verify(token, {
                    secret: process.env.JWT_SECRET || 'changeme',
                });
                userId = payload.sub;
            }
            catch {
                userId = undefined;
            }
        }
        return this.coursesService.getCourseById(courseId, userId);
    }
    async checkEnrollment(courseId, req) {
        return this.coursesService.checkEnrollment(req.user.id, courseId);
    }
    async enroll(courseId, req, body) {
        const result = await this.coursesService.enrollInCourse(req.user.id, courseId, body);
        if ('error' in result && result.error) {
            return {
                error: result.error.message,
                statusCode: result.error.status,
            };
        }
        return result;
    }
    async enrollByEmail(courseId, body) {
        const result = await this.coursesService.enrollInCourseByEmail(courseId, body);
        if ('error' in result && result.error) {
            return {
                error: result.error.message,
                statusCode: result.error.status,
            };
        }
        return result;
    }
};
exports.CoursesController = CoursesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('filter')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "listCourses", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('my-courses'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "listMyCourses", null);
__decorate([
    (0, common_1.Get)('slug/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "getBySlug", null);
__decorate([
    (0, common_1.Get)(':courseId'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "getCourse", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)(':courseId/enrollments/check'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "checkEnrollment", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':courseId/enroll'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "enroll", null);
__decorate([
    (0, common_1.Post)(':courseId/enroll-by-email'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CoursesController.prototype, "enrollByEmail", null);
exports.CoursesController = CoursesController = __decorate([
    (0, common_1.Controller)('courses'),
    __metadata("design:paramtypes", [courses_service_1.CoursesService,
        jwt_1.JwtService])
], CoursesController);
//# sourceMappingURL=courses.controller.js.map