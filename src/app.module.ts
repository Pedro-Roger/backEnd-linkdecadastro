import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { AdminCrmModule } from './admin-crm/admin-crm.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { AgentsModule } from './agents/agents.module';
import { LocationsModule } from './locations/locations.module';
import { EventGroupsModule } from './event-groups/event-groups.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
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
    WhatsAppModule,
    AdminCrmModule,
    AiAssistantModule,
    AgentsModule,
    LocationsModule,
    EventGroupsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
