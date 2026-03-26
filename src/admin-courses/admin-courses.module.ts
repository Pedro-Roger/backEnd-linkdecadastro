import { Module } from '@nestjs/common';
import { AdminCoursesController } from './admin-courses.controller';
import { AdminCoursesService } from './admin-courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsModule } from '../events/events.module';
import { CoursesModule } from '../courses/courses.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    EventsModule,
    CoursesModule,
    RegistrationsModule,
    AuthModule,
    WhatsAppModule,
  ],
  controllers: [AdminCoursesController],
  providers: [AdminCoursesService, PrismaService],
})
export class AdminCoursesModule { }
