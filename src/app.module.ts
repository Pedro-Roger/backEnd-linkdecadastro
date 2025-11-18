import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CoursesModule } from './courses/courses.module';
import { LessonsModule } from './lessons/lessons.module';
import { EventsModule } from './events/events.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminCoursesModule } from './admin-courses/admin-courses.module';
import { AdminEventsModule } from './admin-events/admin-events.module';
import { AdminUploadModule } from './admin-upload/admin-upload.module';
import { ShareModule } from './share/share.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    CoursesModule,
    LessonsModule,
    EventsModule,
    RegistrationsModule,
    NotificationsModule,
    AdminCoursesModule,
    AdminEventsModule,
    AdminUploadModule,
    ShareModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
