import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventsRepository } from './events.repository';

@Injectable()
export class EventsService {
  constructor(private readonly eventsRepository: EventsRepository) { }

  async listEvents(userId: string | undefined, userRole: string | undefined) {
    const where: any = {};
    const isAnyAdmin = userRole?.toUpperCase() === 'ADMIN' || userRole?.toUpperCase() === 'SUPER_ADMIN';

    if (isAnyAdmin) {
      where.createdBy = userId;
    } else {
      where.status = 'ACTIVE';
    }

    return this.eventsRepository.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });
  }

  async createEvent(userId: string, userRole: string | undefined, body: any) {
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Não autorizado');
    }

    const {
      title,
      description,
      bannerUrl,
      maxRegistrations,
      slug,
      groupInviteLink,
      status,
      municipalities,
    } = body;

    const normalizedSlug = slug;
    const linkId = `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return this.eventsRepository.transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title,
          description,
          bannerUrl,
          maxRegistrations,
          slug: normalizedSlug || undefined,
          groupInviteLink: groupInviteLink || undefined,
          linkId,
          createdBy: userId,
          status: status || 'ACTIVE',
        },
      });

      if (
        municipalities &&
        Array.isArray(municipalities) &&
        municipalities.length > 0
      ) {
        await tx.municipalityLimit.createMany({
          data: municipalities.map((m: any) => ({
            eventId: event.id,
            municipality: m.municipality,
            state: m.state,
            defaultLimit: m.defaultLimit,
          })),
        });
      }

      return event;
    });
  }

  async getEventByLink(linkId: string) {
    const event = await this.eventsRepository.findUnique({
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

  async getEventBySlug(slug: string) {
    const normalizedSlug = slug.toLowerCase().trim();
    let event = await this.eventsRepository.findUnique({
      where: { slug: normalizedSlug },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!event && normalizedSlug.startsWith('evt-')) {
      event = await this.eventsRepository.findUnique({
        where: { linkId: normalizedSlug },
        include: {
          _count: {
            select: { registrations: true },
          },
        },
      });
    }

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.status !== 'ACTIVE') {
      throw new ForbiddenException('Evento não está ativo');
    }

    return event;
  }
}
