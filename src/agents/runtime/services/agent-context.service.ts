import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentPromptContext } from '../contracts/agent-runtime.types';

@Injectable()
export class AgentContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, config: any): Promise<AgentPromptContext> {
    const [user, courses, events] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.course
        .findMany({
          where: { createdBy: userId },
          include: {
            _count: { select: { enrollments: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        })
        .catch(() => []),
      this.prisma.event
        .findMany({
          where: { createdBy: userId },
          include: {
            _count: { select: { registrations: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
        .catch(() => []),
    ]);

    return {
      user,
      config,
      courses: courses.map((course) => ({
        title: course.title,
        status: course.status,
        enrollmentsCount: course._count?.enrollments || 0,
      })),
      events: events.map((event) => ({
        title: event.title,
        status: event.status,
        registrationsCount: event._count?.registrations || 0,
      })),
    };
  }
}
