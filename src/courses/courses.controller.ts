import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Post,
  Body,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { JwtService } from '@nestjs/jwt';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  async listCourses(@Query('filter') filter?: string) {
    return this.coursesService.listCourses(filter || undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-courses')
  async listMyCourses(@Req() req: any) {
    return this.coursesService.listMyCourses(req.user.id);
  }

  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.coursesService.getCourseBySlug(slug);
  }

  // Permitir usuário opcional: tenta ler token, se existir usa para trazer enrollment
  @Get(':courseId')
  async getCourse(@Param('courseId') courseId: string, @Req() req: Request) {
    const authHeader = req.headers.authorization;
    let userId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = this.jwtService.verify<JwtPayload>(token, {
          secret: process.env.JWT_SECRET || 'changeme',
        });
        userId = payload.sub;
      } catch {
        userId = undefined;
      }
    }

    return this.coursesService.getCourseById(courseId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':courseId/enrollments/check')
  async checkEnrollment(@Param('courseId') courseId: string, @Req() req: any) {
    return this.coursesService.checkEnrollment(req.user.id, courseId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':courseId/enroll')
  async enroll(
    @Param('courseId') courseId: string,
    @Req() req: any,
    @Body()
    body: {
      cpf?: string;
      birthDate?: string;
      participantType?: string;
      hectares?: any;
      state?: string;
      city?: string;
      whatsappNumber?: string;
    },
  ) {
    const result = await this.coursesService.enrollInCourse(
      req.user.id,
      courseId,
      body,
    );

    if ('error' in result && result.error) {
      return {
        error: result.error.message,
        statusCode: result.error.status,
      };
    }

    return result;
  }
}


