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
exports.AdminEventsController = void 0;
const common_1 = require("@nestjs/common");
const admin_events_service_1 = require("./admin-events.service");
const jwt_guard_1 = require("../auth/jwt.guard");
let AdminEventsController = class AdminEventsController {
    adminEventsService;
    constructor(adminEventsService) {
        this.adminEventsService = adminEventsService;
    }
    async updateEvent(eventId, req, body) {
        return this.adminEventsService.updateEvent(eventId, req.user.role, body);
    }
    async deleteEvent(eventId, req) {
        return this.adminEventsService.deleteEvent(eventId, req.user.role);
    }
    async getHistory(req) {
        return this.adminEventsService.getHistory(req.user.role);
    }
    async getRegions(eventId, req) {
        return this.adminEventsService.getRegionsSummary(eventId, req.user.role);
    }
    async listRegistrations(eventId, req) {
        return this.adminEventsService.listEventRegistrations(eventId, req.user.role);
    }
    async exportRegistrations(eventId, format, fields, req) {
        const fieldsArray = typeof fields === 'string'
            ? fields.split(',').map((f) => f.trim())
            : fields;
        const result = await this.adminEventsService.exportRegistrations(eventId, req.user.role, format, fieldsArray);
        const res = req.res;
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.end(result.buffer);
    }
    async updateMunicipalityLimit(limitId, req, body) {
        return this.adminEventsService.updateMunicipalityLimit(limitId, req.user.role, body);
    }
    async closeClass(classId, req) {
        return this.adminEventsService.closeClass(classId, req.user.role);
    }
};
exports.AdminEventsController = AdminEventsController;
__decorate([
    (0, common_1.Patch)(':eventId'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "updateEvent", null);
__decorate([
    (0, common_1.Delete)(':eventId'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "deleteEvent", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)(':eventId/regions'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "getRegions", null);
__decorate([
    (0, common_1.Get)(':eventId/registrations'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "listRegistrations", null);
__decorate([
    (0, common_1.Get)(':eventId/export'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, common_1.Query)('fields')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "exportRegistrations", null);
__decorate([
    (0, common_1.Patch)('limits/:limitId'),
    __param(0, (0, common_1.Param)('limitId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "updateMunicipalityLimit", null);
__decorate([
    (0, common_1.Patch)('classes/:classId/close'),
    __param(0, (0, common_1.Param)('classId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminEventsController.prototype, "closeClass", null);
exports.AdminEventsController = AdminEventsController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('admin/events'),
    __metadata("design:paramtypes", [admin_events_service_1.AdminEventsService])
], AdminEventsController);
//# sourceMappingURL=admin-events.controller.js.map