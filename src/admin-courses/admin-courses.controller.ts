import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminCoursesService } from './admin-courses.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { Request, Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly adminCoursesService: AdminCoursesService) {}

  @Get()
  async listCourses(@Req() req: any) {
    return this.adminCoursesService.listCourses(req.user.role);
  }

  @Post()
  async createCourse(@Req() req: any, @Body() body: any) {
    return this.adminCoursesService.createCourse(
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Get(':courseId')
  async getCourse(@Param('courseId') courseId: string, @Req() req: any) {
    return this.adminCoursesService.getCourseById(
      courseId,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':courseId')
  async deleteCourse(@Param('courseId') courseId: string, @Req() req: any) {
    await this.adminCoursesService.deleteCourse(
      courseId,
      req.user.id,
      req.user.role,
    );
    return { message: 'Curso excluído com sucesso' };
  }

  @Put(':courseId')
  async updateCourse(
    @Param('courseId') courseId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    return this.adminCoursesService.updateCourse(
      courseId,
      req.user.id,
      req.user.role,
      body,
    );
  }

  // Lessons

  @Get(':courseId/lessons')
  async listLessons(@Param('courseId') courseId: string, @Req() req: any) {
    return this.adminCoursesService.listLessons(courseId, req.user.role);
  }

  @Post(':courseId/lessons')
  async createLesson(
    @Param('courseId') courseId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    return this.adminCoursesService.createLesson(
      courseId,
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Get(':courseId/lessons/:lessonId')
  async getLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Req() req: any,
  ) {
    return this.adminCoursesService.getLesson(
      courseId,
      lessonId,
      req.user.id,
      req.user.role,
    );
  }

  @Put(':courseId/lessons/:lessonId')
  async updateLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    return this.adminCoursesService.updateLesson(
      courseId,
      lessonId,
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Delete(':courseId/lessons/:lessonId')
  async deleteLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Req() req: any,
  ) {
    await this.adminCoursesService.deleteLesson(
      courseId,
      lessonId,
      req.user.id,
      req.user.role,
    );
    return { message: 'Aula excluída com sucesso' };
  }

  // Enrollments

  @Get(':courseId/enrollments')
  async listEnrollments(@Param('courseId') courseId: string, @Req() req: any) {
    return this.adminCoursesService.listEnrollments(courseId, req.user.role);
  }

  // Export

  @Get(':courseId/export')
  async exportGet(
    @Param('courseId') courseId: string,
    @Query('format') format: string | undefined,
    @Query('fields') fields: string | string[] | undefined,
    @Req() req: any & { res?: Response },
  ) {
    try {
      console.log('[exportGet] Iniciando exportação:', { courseId, format, fields });
      
      const fieldsArray =
        typeof fields === 'string'
          ? fields.split(',').map((f) => f.trim())
          : (fields as string[] | undefined);

      const result = await this.adminCoursesService.exportEnrollments(
        courseId,
        req.user.role,
        format,
        fieldsArray,
      );

      console.log('[exportGet] Exportação concluída:', { 
        contentType: result.contentType, 
        filename: result.filename,
        bufferSize: result.buffer?.byteLength || 0 
      });

      const res = req.res as Response;
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );
      res.end(result.buffer);
    } catch (error) {
      console.error('[exportGet] Erro ao exportar:', error);
      const res = req.res as Response;
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro ao exportar dados',
      });
    }
  }
}


