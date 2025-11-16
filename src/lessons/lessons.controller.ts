import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get(':lessonId/comments')
  async getComments(@Param('lessonId') lessonId: string) {
    return this.lessonsService.getComments(lessonId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':lessonId/comments')
  async addComment(
    @Param('lessonId') lessonId: string,
    @Req() req: any,
    @Body() body: { content: string },
  ) {
    return this.lessonsService.addComment(
      req.user.id,
      lessonId,
      body.content,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':lessonId/progress')
  async updateProgress(
    @Param('lessonId') lessonId: string,
    @Req() req: any,
    @Body() body: { watchedTime: number; completed: boolean },
  ) {
    return this.lessonsService.updateProgress(
      req.user.id,
      lessonId,
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':lessonId/progress')
  async getProgress(@Param('lessonId') lessonId: string, @Req() req: any) {
    return this.lessonsService.getProgress(req.user.id, lessonId);
  }
}


