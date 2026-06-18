import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParticipantType, MunicipalityClassStatus } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EventGroupsService } from '../event-groups/event-groups.service';
import { EventCityService } from '../event-city/event-city.service';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly eventGroupsService: EventGroupsService,
    @Optional() private readonly eventCityService?: EventCityService,
  ) { }

  async createRegistration(data: {
    eventId: string;
    name: string;
    cpf: string;
    phone: string;
    email: string;
    cep: string;
    locality: string;
    city: string;
    state: string;
    participantType: ParticipantType;
    otherType?: string;
    pondCount?: number;
    waterArea?: number;
  }) {

    let municipalityLimit = await this.prisma.municipalityLimit.findFirst({
      where: {
        eventId: data.eventId,
        municipality: data.city,
        state: data.state,
      },
    });

    const unlimitedClassSize = 999999;

    if (!municipalityLimit) {
      municipalityLimit = await this.prisma.municipalityLimit.create({
        data: {
          eventId: data.eventId,
          municipality: data.city,
          state: data.state,
          defaultLimit: unlimitedClassSize,
        },
      });
    }

    let activeClass = await this.prisma.municipalityClass.findFirst({
      where: {
        municipalityLimitId: municipalityLimit.id,
        status: MunicipalityClassStatus.ACTIVE,
      },
      orderBy: {
        classNumber: 'desc',
      },
    });

    if (!activeClass) {
      activeClass = await this.prisma.municipalityClass.create({
        data: {
          municipalityLimitId: municipalityLimit.id,
          classNumber: 1,
          limit: municipalityLimit.defaultLimit || unlimitedClassSize,
          currentCount: 0,
        },
      });
    }

    const existingReg = await this.prisma.registration.findFirst({
      where: { eventId: data.eventId, cpf: data.cpf },
    });

    let registration;
    if (existingReg) {
      registration = await this.prisma.registration.update({
        where: { id: existingReg.id },
        data: {
          status: 'CONFIRMED',
          phone: data.phone,
          email: data.email,
          name: data.name,
        },
      });
    } else {
      // Reserva vaga no controle de cidades (apenas para inscrições novas)
      if (this.eventCityService) {
        await this.eventCityService.reserveSlot(data.eventId, data.city, data.state);
      }

      await this.prisma.municipalityClass.update({
        where: { id: activeClass.id },
        data: { currentCount: { increment: 1 } },
      });

      registration = await this.prisma.registration.create({
        data: {
          ...data,
          municipalityId: municipalityLimit.id,
          municipalityClassId: activeClass.id,
          batchNumber: activeClass.classNumber,
          status: 'CONFIRMED',
        },
      });
    }

    return registration;
  }

  async findByCpf(cpf: string, eventId?: string) {
    const existingRegistration = eventId
      ? await this.prisma.registration.findFirst({
          where: { cpf, eventId },
          select: {
            id: true,
            createdAt: true,
          },
        })
      : null;

    const registration = await this.prisma.registration.findFirst({
      where: { cpf },
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        email: true,
        phone: true,
        cep: true,
        state: true,
        city: true,
        locality: true,
        participantType: true,
        otherType: true,
        pondCount: true,
        waterArea: true,
      },
    });

    if (!registration) {
      const user = await this.prisma.user.findFirst({
        where: { cpf },
        select: {
          name: true,
          email: true,
          phone: true,
          state: true,
          city: true,
          participantType: true,
          hectares: true,
          waterArea: true,
          ponds: true,
        },
      });

      if (user) {
        return {
          profile: {
            name: user.name,
            email: user.email,
            phone: user.phone,
            state: user.state,
            city: user.city,
            participantType: user.participantType,
            pondCount: user.ponds,
            waterArea: user.waterArea,
            cep: '',
            locality: '',
          },
          existingRegistration,
        };
      }
      return null;
    }

    return {
      profile: registration,
      existingRegistration,
    };
  }

  async handleRegistration(body: any) {
    const data = body as {
      eventId: string;
      name: string;
      cpf: string;
      phone: string;
      email: string;
      cep: string;
      locality: string;
      city: string;
      state: string;
      participantType: ParticipantType | 'OUTROS';
      otherType?: string;
      pondCount?: number;
      waterArea?: number;
    };

    const event = await this.prisma.event.findUnique({
      where: { id: data.eventId },
    });

    if (!event || event.status !== 'ACTIVE') {
      throw new NotFoundException('Evento nao encontrado ou inativo');
    }

    const participantType =
      data.participantType === 'OUTROS'
        ? ParticipantType.ESTUDANTE
        : data.participantType;

    const registration = await this.createRegistration({
      ...data,
      participantType,
    });

    if ('error' in registration && registration.error) {
      return registration;
    }

    try {
      await this.emailService.sendRegistrationEmail(
        data.email,
        data.name,
        event.title,
      );

      const admin = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });

      if (admin) {
        await this.emailService.sendAdminNotificationEmail(admin.email, {
          name: data.name,
          email: data.email,
          cpf: data.cpf,
          city: data.city,
          eventTitle: event.title,
        });
      }

      const firstName = data.name.split(' ')[0];
      await this.whatsappService.sendMessageToPhone(
        data.phone,
        `Ola ${firstName}, obrigado por se cadastrar no evento "${event.title}"! Seu cadastro foi confirmado com sucesso.`
      );

      await this.eventGroupsService.enqueueIfEligible(
        registration.id,
        data.eventId,
        data.phone,
        data.name,
        data.city,
        data.state,
      );

    } catch (error) {
      console.error('Error sending email or WhatsApp:', error);
    }

    return registration;
  }

  async listRegistrations(eventId?: string | null) {
    return this.prisma.registration.findMany({
      where: eventId ? { eventId } : undefined,
      include: {
        event: {
          select: {
            title: true,
          },
        },
        municipality: {
          select: {
            municipality: true,
            state: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
