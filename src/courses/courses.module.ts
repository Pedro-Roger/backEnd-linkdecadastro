import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CoursesRepository } from './courses.repository';
import { EnrollmentsRepository } from './enrollments.repository';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesRepository, EnrollmentsRepository, PrismaService],
  exports: [CoursesRepository, EnrollmentsRepository],
})
export class CoursesModule { }
