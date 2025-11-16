import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvents(userRole: string | undefined) {
    if (!userRole) {
      throw new ForbiddenException('Não autorizado');
    }

    return this.prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });
  }

  async createEvent(userId: string, userRole: string | undefined, body: any) {
    if (!userRole || userRole !== 'ADMIN') {
      throw new ForbiddenException('Não autorizado');
    }

    const { title, description, bannerUrl, maxRegistrations } = body;

    const linkId = `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return this.prisma.event.create({
      data: {
        title,
        description,
        bannerUrl,
        maxRegistrations,
        linkId,
        createdBy: userId,
        status: 'ACTIVE',
      },
    });
  }

  async getEventByLink(linkId: string) {
    const event = await this.prisma.event.findUnique({
      where: { linkId },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.status !== 'ACTIVE') {
      throw new ForbiddenException('Evento não está ativo');
    }

    return event;
  }
}


