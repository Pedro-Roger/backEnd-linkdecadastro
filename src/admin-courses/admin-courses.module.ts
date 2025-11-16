import { Module } from '@nestjs/common';
import { AdminCoursesController } from './admin-courses.controller';
import { AdminCoursesService } from './admin-courses.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AdminCoursesController],
  providers: [AdminCoursesService, PrismaService],
})
export class AdminCoursesModule {}


