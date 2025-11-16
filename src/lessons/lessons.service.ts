import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async getComments(lessonId: string) {
    return this.prisma.comment.findMany({
      where: { lessonId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addComment(userId: string, lessonId: string, content: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: lesson.courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        'Você precisa estar inscrito no curso para comentar',
      );
    }

    const comment = await this.prisma.comment.create({
      data: {
        userId,
        lessonId,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
      },
    });

    if (lesson.course.createdBy !== userId) {
      await this.prisma.notification.create({
        data: {
          userId: lesson.course.createdBy,
          type: 'NEW_COMMENT',
          title: 'Novo comentário',
          message: `${comment.user.name} comentou na aula "${lesson.title}"`,
          link: `/course/${lesson.courseId}`,
        },
      });
    }

    return comment;
  }

  async updateProgress(
    userId: string,
    lessonId: string,
    data: { watchedTime: number; completed: boolean },
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: lesson.courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('Você não está inscrito neste curso');
    }

    const progress = await this.prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      update: {
        watchedTime: data.watchedTime,
        completed: data.completed,
        completedAt: data.completed ? new Date() : null,
      },
      create: {
        userId,
        lessonId,
        watchedTime: data.watchedTime,
        completed: data.completed,
        completedAt: data.completed ? new Date() : null,
      },
    });

    if (data.completed) {
      const totalLessons = await this.prisma.lesson.count({
        where: { courseId: lesson.courseId },
      });

      const completedLessons = await this.prisma.lessonProgress.count({
        where: {
          userId,
          completed: true,
          lesson: {
            courseId: lesson.courseId,
          },
        },
      });

      const courseProgress = Math.round(
        (completedLessons / totalLessons) * 100,
      );

      await this.prisma.enrollment.update({
        where: {
          userId_courseId: {
            userId,
            courseId: lesson.courseId,
          },
        },
        data: {
          progress: courseProgress,
          completedAt: courseProgress === 100 ? new Date() : null,
        },
      });

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'LESSON_COMPLETED',
          title: 'Aula concluída!',
          message: `Você concluiu a aula "${lesson.title}"`,
          link: `/course/${lesson.courseId}`,
        },
      });
    }

    return progress;
  }

  async getProgress(userId: string, lessonId: string) {
    const progress = await this.prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
    });

    return progress || { completed: false, watchedTime: 0 };
  }
}


