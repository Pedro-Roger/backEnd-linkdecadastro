"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const user_module_1 = require("./user/user.module");
const courses_module_1 = require("./courses/courses.module");
const lessons_module_1 = require("./lessons/lessons.module");
const events_module_1 = require("./events/events.module");
const registrations_module_1 = require("./registrations/registrations.module");
const notifications_module_1 = require("./notifications/notifications.module");
const admin_courses_module_1 = require("./admin-courses/admin-courses.module");
const admin_events_module_1 = require("./admin-events/admin-events.module");
const admin_upload_module_1 = require("./admin-upload/admin-upload.module");
const share_module_1 = require("./share/share.module");
const whatsapp_module_1 = require("./whatsapp/whatsapp.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            courses_module_1.CoursesModule,
            lessons_module_1.LessonsModule,
            events_module_1.EventsModule,
            registrations_module_1.RegistrationsModule,
            notifications_module_1.NotificationsModule,
            admin_courses_module_1.AdminCoursesModule,
            admin_events_module_1.AdminEventsModule,
            admin_upload_module_1.AdminUploadModule,
            share_module_1.ShareModule,
            whatsapp_module_1.WhatsAppModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map