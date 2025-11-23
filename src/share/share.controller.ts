import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ShareService } from './share.service';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get('course/:courseId')
  async getCourseShare(@Param('courseId') courseId: string, @Res() res: Response) {
    try {
      const course = await this.shareService.getCoursePreviewData(courseId);
      
      const frontendUrl = process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
      const siteUrl = frontendUrl.replace(/\/$/, '');
      const url = course.slug 
        ? `${siteUrl}/c/${course.slug}`
        : `${siteUrl}/course/${course.id}`;

      const html = this.shareService.generateOpenGraphHTML({
        title: course.title,
        description: course.description,
        bannerUrl: course.bannerUrl,
        url,
        type: 'article',
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Curso não encontrado');
    }
  }

  @Get('event/:eventIdOrSlug')
  async getEventShare(@Param('eventIdOrSlug') eventIdOrSlug: string, @Res() res: Response) {
    try {
      const event = await this.shareService.getEventPreviewData(eventIdOrSlug);
      
      const frontendUrl = process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
      const siteUrl = frontendUrl.replace(/\/$/, '');
      const url = event.slug 
        ? `${siteUrl}/e/${event.slug}`
        : `${siteUrl}/register/${event.linkId}`;

      const html = this.shareService.generateOpenGraphHTML({
        title: event.title,
        description: event.description,
        bannerUrl: event.bannerUrl,
        url,
        type: 'article',
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Evento não encontrado');
    }
  }

  @Get('enroll/:courseSlugOrId')
  async getEnrollShare(@Param('courseSlugOrId') courseSlugOrId: string, @Res() res: Response) {
    try {
      // Decodifica o parâmetro da URL
      const decodedParam = decodeURIComponent(courseSlugOrId);
      
      // Busca o curso por slug ou ID
      const course = await this.shareService.getCoursePreviewData(decodedParam);
      
      const frontendUrl = process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
      const siteUrl = frontendUrl.replace(/\/$/, '');
      const url = course.slug 
        ? `${siteUrl}/enroll.html?course=${encodeURIComponent(course.slug)}`
        : `${siteUrl}/enroll.html?course=${course.id}`;

      const html = this.shareService.generateOpenGraphHTML({
        title: course.title,
        description: course.description,
        bannerUrl: course.bannerUrl,
        url,
        type: 'website',
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Curso não encontrado');
    }
  }
}

