import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MunicipalityClassStatus, ParticipantType } from '@prisma/client';

@Injectable()
export class AdminEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Não autorizado');
    }
  }

  async updateEvent(
    eventId: string,
    userRole: string | undefined,
    body: any,
  ) {
    this.assertAdmin(userRole);

    const { title, description, bannerUrl, maxRegistrations, status } = body;

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (maxRegistrations !== undefined)
      updates.maxRegistrations = maxRegistrations;
    if (bannerUrl !== undefined) {
      updates.bannerUrl = bannerUrl ? bannerUrl : null;
    }

    const event = await this.prisma.event.update({
      where: { id: eventId },
      data: updates,
    });

    return event;
  }

  async deleteEvent(eventId: string, userRole: string | undefined) {
    this.assertAdmin(userRole);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    await this.prisma.event.delete({ where: { id: eventId } });

    return { success: true };
  }

  async getHistory(userRole: string | undefined) {
    this.assertAdmin(userRole);

    const events = await this.prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        bannerUrl: true,
        status: true,
        maxRegistrations: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const history = await Promise.all(
      events.map(async (event) => {
        const totalRegistrations = await this.prisma.registration.count({
          where: { eventId: event.id },
        });

        const municipalities = await this.prisma.municipalityLimit.findMany({
          where: { eventId: event.id },
          select: {
            id: true,
            municipality: true,
            state: true,
            defaultLimit: true,
            classes: {
              select: {
                id: true,
                classNumber: true,
                limit: true,
                currentCount: true,
                status: true,
                createdAt: true,
                closedAt: true,
              },
              orderBy: { classNumber: 'asc' },
            },
          },
        });

        return {
          ...event,
          totalRegistrations,
          municipalitiesCount: municipalities.length,
          municipalities,
        };
      }),
    );

    return history;
  }

  async getRegionsSummary(eventId: string, userRole: string | undefined) {
    this.assertAdmin(userRole);

    const municipalityLimits = await this.prisma.municipalityLimit.findMany({
      where: { eventId },
      include: {
        classes: {
          orderBy: { classNumber: 'asc' },
        },
      },
      orderBy: [
        { state: 'asc' },
        { municipality: 'asc' },
      ],
    });

    const registrations = await this.prisma.registration.findMany({
      where: { eventId },
      select: {
        id: true,
        municipalityId: true,
        municipalityClassId: true,
        participantType: true,
        city: true,
        state: true,
        status: true,
      },
    });

    const overallByState = new Map<
      string,
      {
        total: number;
        byParticipantType: Partial<Record<ParticipantType, number>>;
      }
    >();

    const overallByType: Partial<Record<ParticipantType, number>> = {};

    registrations.forEach((registration) => {
      if (!overallByState.has(registration.state)) {
        overallByState.set(registration.state, {
          total: 0,
          byParticipantType: {},
        });
      }
      const stateInfo = overallByState.get(registration.state)!;
      stateInfo.total += 1;
      stateInfo.byParticipantType[registration.participantType] =
        (stateInfo.byParticipantType[registration.participantType] ?? 0) + 1;

      overallByType[registration.participantType] =
        (overallByType[registration.participantType] ?? 0) + 1;
    });

    const limitsWithSummary = municipalityLimits.map((limit) => {
      const regsForMunicipality = registrations.filter(
        (registration) => registration.municipalityId === limit.id,
      );

      const byParticipantType: Partial<Record<ParticipantType, number>> = {};
      regsForMunicipality.forEach((registration) => {
        byParticipantType[registration.participantType] =
          (byParticipantType[registration.participantType] ?? 0) + 1;
      });

      const classes = limit.classes.map((classItem) => {
        const regsForClass = regsForMunicipality.filter(
          (registration) =>
            registration.municipalityClassId === classItem.id,
        );

        return {
          id: classItem.id,
          classNumber: classItem.classNumber,
          limit: classItem.limit,
          currentCount: classItem.currentCount,
          status: classItem.status,
          createdAt: classItem.createdAt,
          closedAt: classItem.closedAt,
          registrations: regsForClass.length,
        };
      });

      const activeClass = classes.find(
        (classItem) => classItem.status === MunicipalityClassStatus.ACTIVE,
      );

      return {
        id: limit.id,
        municipality: limit.municipality,
        state: limit.state,
        defaultLimit: limit.defaultLimit,
        totalRegistrations: regsForMunicipality.length,
        byParticipantType,
        classes,
        activeClassNumber: activeClass?.classNumber ?? null,
        activeClassLimit: activeClass?.limit ?? null,
        activeClassCount: activeClass?.currentCount ?? null,
      };
    });

    return {
      regions: limitsWithSummary,
      overall: {
        totalRegistrations: registrations.length,
        byParticipantType: overallByType,
        byState: Array.from(overallByState.entries()).map(([state, info]) => ({
          state,
          total: info.total,
          byParticipantType: info.byParticipantType,
        })),
      },
    };
  }
}


