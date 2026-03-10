import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParticipantType, MunicipalityClassStatus } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
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
    // Verificar se já existe inscrição PARA ESTE EVENTO com este CPF
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        cpf: data.cpf,
        eventId: data.eventId,
      },
    });

    if (existingRegistration) {
      throw new Error('CPF já cadastrado neste evento');
    }

    let municipalityLimit = await this.prisma.municipalityLimit.findFirst({
      where: {
        eventId: data.eventId,
        municipality: data.city,
        state: data.state,
      },
    });

    if (!municipalityLimit) {
      municipalityLimit = await this.prisma.municipalityLimit.create({
        data: {
          eventId: data.eventId,
          municipality: data.city,
          state: data.state,
          defaultLimit: 20,
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
          limit: municipalityLimit.defaultLimit,
          currentCount: 0,
        },
      });
    }

    if (activeClass.currentCount >= activeClass.limit) {
      await this.prisma.municipalityClass.update({
        where: { id: activeClass.id },
        data: {
          status: MunicipalityClassStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      activeClass = await this.prisma.municipalityClass.create({
        data: {
          municipalityLimitId: municipalityLimit.id,
          classNumber: activeClass.classNumber + 1,
          limit: municipalityLimit.defaultLimit,
          currentCount: 0,
        },
      });
    }

    await this.prisma.municipalityClass.update({
      where: { id: activeClass.id },
      data: {
        currentCount: {
          increment: 1,
        },
      },
    });

    const registration = await this.prisma.registration.create({
      data: {
        ...data,
        municipalityId: municipalityLimit.id,
        municipalityClassId: activeClass.id,
        batchNumber: activeClass.classNumber,
        status: 'CONFIRMED',
      },
    });

    return registration;
  }

  // Novo método para buscar dados de cadastro anterior pelo CPF
  async findByCpf(cpf: string) {
    // Busca o registro mais recente com este CPF
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

    // Se não achar em registrations, tenta em users
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
          name: user.name,
          email: user.email,
          phone: user.phone,
          state: user.state,
          city: user.city,
          participantType: user.participantType,
          pondCount: user.ponds,
          waterArea: user.waterArea,
          // Campos default que o user não tem
          cep: '',
          locality: '',
        };
      }
      return null;
    }

    return registration;
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
      throw new NotFoundException('Evento não encontrado ou inativo');
    }

    const participantType =
      data.participantType === 'OUTROS'
        ? ParticipantType.ESTUDANTE
        : data.participantType;

    const registration = await this.createRegistration({
      ...data,
      participantType,
    });

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

      // Envio de WhatsApp automático
      await this.whatsappService.sendMessageToPhone(
        data.phone,
        `Olá ${data.name.split(' ')[0]}, obrigado por se cadastrar no evento "${event.title}"! Seu cadastro foi confirmado com sucesso. ✅`
      );

    } catch (error) {
      console.error('Erro ao enviar email ou WhatsApp:', error);
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
