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
exports.AdminCoursesController = void 0;
const common_1 = require("@nestjs/common");
const admin_courses_service_1 = require("./admin-courses.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const create_course_dto_1 = require("./dto/create-course.dto");
const update_course_dto_1 = require("./dto/update-course.dto");
let AdminCoursesController = class AdminCoursesController {
    adminCoursesService;
    constructor(adminCoursesService) {
        this.adminCoursesService = adminCoursesService;
    }
    async listCourses(req) {
        return this.adminCoursesService.listCourses(req.user.role);
    }
    async listEnrollmentsForWhatsApp(req, city, state, participantType) {
        return this.adminCoursesService.listAllEnrollmentsForWhatsApp(req.user.role, {
            city,
            state,
            participantType,
        });
    }
    async createCourse(req, body) {
        return this.adminCoursesService.createCourse(req.user.id, req.user.role, body);
    }
    async getCourse(courseId, req) {
        return this.adminCoursesService.getCourseById(courseId, req.user.id, req.user.role);
    }
    async deleteCourse(courseId, req) {
        await this.adminCoursesService.deleteCourse(courseId, req.user.id, req.user.role);
        return { message: 'Curso excluído com sucesso' };
    }
    async updateCourse(courseId, req, body) {
        return this.adminCoursesService.updateCourse(courseId, req.user.id, req.user.role, body);
    }
    async listLessons(courseId, req) {
        return this.adminCoursesService.listLessons(courseId, req.user.role);
    }
    async createLesson(courseId, req, body) {
        return this.adminCoursesService.createLesson(courseId, req.user.id, req.user.role, body);
    }
    async getLesson(courseId, lessonId, req) {
        return this.adminCoursesService.getLesson(courseId, lessonId, req.user.id, req.user.role);
    }
    async updateLesson(courseId, lessonId, req, body) {
        return this.adminCoursesService.updateLesson(courseId, lessonId, req.user.id, req.user.role, body);
    }
    async deleteLesson(courseId, lessonId, req) {
        await this.adminCoursesService.deleteLesson(courseId, lessonId, req.user.id, req.user.role);
        return { message: 'Aula excluída com sucesso' };
    }
    async listEnrollments(courseId, req) {
        return this.adminCoursesService.listEnrollments(courseId, req.user.role);
    }
    async exportGet(courseId, format, fields, req) {
        try {
            const fieldsArray = typeof fields === 'string'
                ? fields.split(',').map((f) => f.trim())
                : fields;
            const result = await this.adminCoursesService.exportEnrollments(courseId, req.user.role, format, fieldsArray);
            const res = req.res;
            res.setHeader('Content-Type', result.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            const buffer = Buffer.isBuffer(result.buffer)
                ? result.buffer
                : Buffer.from(result.buffer);
            res.end(buffer);
        }
        catch (error) {
            const res = req.res;
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Erro ao exportar dados',
            });
        }
    }
    async listCourseClasses(courseId, req) {
        return this.adminCoursesService.listCourseClasses(courseId, req.user.role);
    }
    async createCourseClass(courseId, req, body) {
        return this.adminCoursesService.createCourseClass(courseId, req.user.role, body);
    }
    async closeCourseClass(classId, req) {
        return this.adminCoursesService.closeCourseClass(classId, req.user.role);
    }
};
exports.AdminCoursesController = AdminCoursesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "listCourses", null);
__decorate([
    (0, common_1.Get)('enrollments/whatsapp'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('city')),
    __param(2, (0, common_1.Query)('state')),
    __param(3, (0, common_1.Query)('participantType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "listEnrollmentsForWhatsApp", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_course_dto_1.CreateCourseDto]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "createCourse", null);
__decorate([
    (0, common_1.Get)(':courseId'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "getCourse", null);
__decorate([
    (0, common_1.Delete)(':courseId'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "deleteCourse", null);
__decorate([
    (0, common_1.Put)(':courseId'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, update_course_dto_1.UpdateCourseDto]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "updateCourse", null);
__decorate([
    (0, common_1.Get)(':courseId/lessons'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "listLessons", null);
__decorate([
    (0, common_1.Post)(':courseId/lessons'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "createLesson", null);
__decorate([
    (0, common_1.Get)(':courseId/lessons/:lessonId'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Param)('lessonId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "getLesson", null);
__decorate([
    (0, common_1.Put)(':courseId/lessons/:lessonId'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Param)('lessonId')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "updateLesson", null);
__decorate([
    (0, common_1.Delete)(':courseId/lessons/:lessonId'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Param)('lessonId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "deleteLesson", null);
__decorate([
    (0, common_1.Get)(':courseId/enrollments'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "listEnrollments", null);
__decorate([
    (0, common_1.Get)(':courseId/export'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, common_1.Query)('fields')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "exportGet", null);
__decorate([
    (0, common_1.Get)(':courseId/classes'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "listCourseClasses", null);
__decorate([
    (0, common_1.Post)(':courseId/classes'),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "createCourseClass", null);
__decorate([
    (0, common_1.Patch)('classes/:classId/close'),
    __param(0, (0, common_1.Param)('classId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminCoursesController.prototype, "closeCourseClass", null);
exports.AdminCoursesController = AdminCoursesController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('admin/courses'),
    __metadata("design:paramtypes", [admin_courses_service_1.AdminCoursesService])
], AdminCoursesController);
//# sourceMappingURL=admin-courses.controller.js.map