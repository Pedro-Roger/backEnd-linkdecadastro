import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) { }

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

    const { title, description, bannerUrl, maxRegistrations, slug } = body;

    // Normalizar e validar slug
    let normalizedSlug: string | null = null;
    if (slug && typeof slug === 'string' && slug.trim()) {
      normalizedSlug = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais e espaços por hífen
        .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim
    } else {
      normalizedSlug = null;
    }

    const linkId = `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return this.prisma.event.create({
      data: {
        title,
        description,
        bannerUrl,
        maxRegistrations,
        slug: normalizedSlug || undefined,
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

  async getEventBySlug(slug: string) {
    const normalizedSlug = slug.toLowerCase().trim();
    const event = await this.prisma.event.findUnique({
      where: { slug: normalizedSlug },
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


