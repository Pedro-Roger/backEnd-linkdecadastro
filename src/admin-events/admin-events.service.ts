import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MunicipalityClassStatus, ParticipantType } from '@prisma/client';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

import { EventsRepository } from '../events/events.repository';
import { RegistrationsRepository } from '../registrations/registrations.repository';
import { MunicipalitiesRepository } from '../events/municipalities.repository';

@Injectable()
export class AdminEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsRepository: EventsRepository,
    private readonly registrationsRepository: RegistrationsRepository,
    private readonly municipalitiesRepository: MunicipalitiesRepository,
  ) { }

  private assertAdmin(role?: string) {
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Não autorizado');
    }
  }

  private getOwnedWhereClause(
    userId: string,
    userRole: string | undefined,
    otherFilters: any = {},
  ) {
    if (userRole?.toUpperCase() === 'SUPER_ADMIN') {
      return otherFilters;
    }
    return { ...otherFilters, createdBy: userId };
  }

  async updateEvent(
    eventId: string,
    userId: string,
    userRole: string | undefined,
    body: any,
  ) {
    this.assertAdmin(userRole);

    const { title, description, bannerUrl, maxRegistrations, status, slug, whatsappGroupsEnabled, whatsappSessionId } = body;

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (maxRegistrations !== undefined)
      updates.maxRegistrations = maxRegistrations;
    if (bannerUrl !== undefined) {
      updates.bannerUrl = bannerUrl ? bannerUrl : null;
    }
    if (slug !== undefined) {
      updates.slug = slug ? slug : null;
    }
    if (whatsappGroupsEnabled !== undefined)
      updates.whatsappGroupsEnabled = whatsappGroupsEnabled;
    if (whatsappSessionId !== undefined)
      updates.whatsappSessionId = whatsappSessionId ? whatsappSessionId : null;

    const event = await this.eventsRepository.findFirst({
      where: this.getOwnedWhereClause(userId || '', userRole, { id: eventId }),
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado ou acesso negado');
    }

    return this.eventsRepository.update({
      where: { id: eventId },
      data: updates,
    });
  }

  async getEventById(
    eventId: string,
    userId: string,
    userRole: string | undefined,
  ) {
    this.assertAdmin(userRole);

    const event = await this.eventsRepository.findFirst({
      where: this.getOwnedWhereClause(userId || '', userRole, { id: eventId }),
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento nÃ£o encontrado ou acesso negado');
    }

    return event;
  }

  async deleteEvent(
    eventId: string,
    userId: string,
    userRole: string | undefined,
  ) {
    this.assertAdmin(userRole);

    const event = await this.eventsRepository.findFirst({
      where: this.getOwnedWhereClause(userId, userRole, { id: eventId }),
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    await this.eventsRepository.delete({ where: { id: eventId } });

    return { success: true };
  }

  async getHistory(userId: string, userRole: string | undefined) {
    this.assertAdmin(userRole);

    const where = this.getOwnedWhereClause(userId, userRole);

    const events = await this.eventsRepository.findMany({
      where,
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
        createdBy: true,
      },
    });

    const history = await Promise.all(
      events.map(async (event) => {
        const totalRegistrations = await this.registrationsRepository.count({
          where: { eventId: event.id },
        });

        const municipalities = await this.municipalitiesRepository.findManyLimits({
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
          _count: { registrations: totalRegistrations },
          municipalitiesCount: municipalities.length,
          municipalities,
        };
      }),
    );

    return history;
  }

  async getRegionsSummary(
    eventId: string,
    userId: string,
    userRole: string | undefined,
  ) {
    this.assertAdmin(userRole);

    const whereEvent = this.getOwnedWhereClause(userId, userRole, {
      id: eventId,
    });
    const eventOwned = await this.eventsRepository.findFirst({
      where: whereEvent,
    });

    if (!eventOwned) {
      throw new NotFoundException('Evento não encontrado ou acesso negado');
    }

    const municipalityLimits = await this.municipalitiesRepository.findManyLimits({
      where: { eventId },
      include: {
        classes: {
          orderBy: { classNumber: 'asc' },
        },
      },
      orderBy: [{ state: 'asc' }, { municipality: 'asc' }],
    });

    const registrations = await this.registrationsRepository.findMany({
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
      const pType = registration.participantType as ParticipantType;
      stateInfo.byParticipantType[pType] =
        (stateInfo.byParticipantType[pType] ?? 0) + 1;

      overallByType[pType] =
        (overallByType[pType] ?? 0) + 1;
    });

    const limitsWithSummary = municipalityLimits.map((limit) => {
      const regsForMunicipality = registrations.filter(
        (registration) => registration.municipalityId === limit.id,
      );

      const byParticipantType: Partial<Record<ParticipantType, number>> = {};
      regsForMunicipality.forEach((registration) => {
        const pType = registration.participantType as ParticipantType;
        byParticipantType[pType] =
          (byParticipantType[pType] ?? 0) + 1;
      });

      const classes = limit.classes.map((classItem: any) => {
        const regsForClass = regsForMunicipality.filter(
          (registration) => registration.municipalityClassId === classItem.id,
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
        (classItem: any) => classItem.status === MunicipalityClassStatus.ACTIVE,
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

  async listEventRegistrations(
    eventId: string,
    userId: string,
    userRole: string | undefined,
  ) {
    this.assertAdmin(userRole);

    const whereEvent = this.getOwnedWhereClause(userId, userRole, {
      id: eventId,
    });

    const event = await this.eventsRepository.findFirst({
      where: whereEvent,
      select: { id: true, title: true },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado ou acesso negado');
    }

    const registrations = await this.registrationsRepository.findMany({
      where: { eventId },
      include: {
        municipality: {
          select: {
            municipality: true,
            state: true,
          },
        },
        municipalityClass: {
          select: {
            classNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      event,
      registrations,
    };
  }

  async exportRegistrations(
    eventId: string,
    userId: string,
    userRole: string | undefined,
    formatParam?: string,
    fieldsParam?: string[],
    classId?: string,
    municipalityId?: string,
    city?: string,
    state?: string,
  ) {
    this.assertAdmin(userRole);

    const whereEvent = this.getOwnedWhereClause(userId, userRole, {
      id: eventId,
    });

    const event = await this.eventsRepository.findFirst({
      where: whereEvent,
      select: {
        title: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado ou acesso negado');
    }

    const whereClause: any = { eventId };
    let filenameSuffix = '';

    if (classId) {
      whereClause.municipalityClassId = classId;
      const classInfo = await this.municipalitiesRepository.findUniqueClass({
        where: { id: classId },
        include: { municipalityLimit: true },
      });
      if (classInfo) {
        filenameSuffix = `-${classInfo.municipalityLimit.municipality}-turma-${classInfo.classNumber}`;
      }
    } else if (municipalityId) {
      whereClause.municipalityId = municipalityId;
      const munLimit = await this.municipalitiesRepository.findUniqueLimit({
        where: { id: municipalityId },
      });
      if (munLimit) {
        filenameSuffix = `-${munLimit.municipality}-${munLimit.state}`;
      }
    } else if (city) {
      whereClause.city = { equals: city, mode: 'insensitive' };
      if (state) {
        whereClause.state = { equals: state, mode: 'insensitive' };
      }
      filenameSuffix = `-${city}-${state || ''}`;
    }

    const registrations = await this.registrationsRepository.findMany({
      where: whereClause,
      include: {
        municipality: {
          select: {
            municipality: true,
            state: true,
          },
        },
        municipalityClass: {
          select: {
            classNumber: true,
          },
        },
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });

    const participantTypeLabels: Record<ParticipantType, string> = {
      PRODUTOR: 'Produtor',
      ESTUDANTE: 'Estudante',
      PROFESSOR: 'Professor',
      PESQUISADOR: 'Pesquisador',
    };

    const statusLabels: Record<string, string> = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      CANCELLED: 'Cancelado',
    };

    const availableFields = {
      number: {
        label: 'Nº',
        getter: (_r: any) => 0,
      },
      name: {
        label: 'Nome Completo',
        getter: (r: any) => r.name,
      },
      cpf: {
        label: 'CPF',
        getter: (r: any) => r.cpf,
      },
      email: {
        label: 'E-mail',
        getter: (r: any) => r.email,
      },
      phone: {
        label: 'Telefone',
        getter: (r: any) => r.phone,
      },
      cep: {
        label: 'CEP',
        getter: (r: any) => r.cep,
      },
      locality: {
        label: 'Localidade/Bairro',
        getter: (r: any) => r.locality,
      },
      city: {
        label: 'Cidade',
        getter: (r: any) => r.city,
      },
      state: {
        label: 'Estado',
        getter: (r: any) => r.state,
      },
      participantType: {
        label: 'Tipo de Participante',
        getter: (r: any) =>
          participantTypeLabels[r.participantType as ParticipantType] ||
          r.participantType ||
          '-',
      },
      otherType: {
        label: 'O que você é?',
        getter: (r: any) => r.otherType || '-',
      },
      pondCount: {
        label: 'Quantidade de Viveiros',
        getter: (r: any) => r.pondCount ?? '-',
      },
      waterArea: {
        label: "Lâmina d'água (ha)",
        getter: (r: any) => r.waterArea ?? '-',
      },
      municipality: {
        label: 'Município',
        getter: (r: any) => r.municipality?.municipality || r.city || '-',
      },
      classNumber: {
        label: 'Turma',
        getter: (r: any) =>
          r.municipalityClass?.classNumber || r.batchNumber || '-',
      },
      status: {
        label: 'Status',
        getter: (r: any) => statusLabels[r.status] || r.status || '-',
      },
      createdAt: {
        label: 'Data de Cadastro',
        getter: (r: any) =>
          new Date(r.createdAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
      },
    } as const;

    const defaultFields = [
      'number',
      'name',
      'cpf',
      'email',
      'phone',
      'city',
      'state',
      'participantType',
      'classNumber',
      'createdAt',
    ] as const;
    type FieldKey = keyof typeof availableFields;

    function parseFields(fields?: string[]): FieldKey[] {
      if (!fields || fields.length === 0) {
        return [...defaultFields] as FieldKey[];
      }
      const parsed = fields
        .map((field) => field.trim())
        .filter((field): field is FieldKey => field in availableFields);
      return parsed.length > 0 ? parsed : ([...defaultFields] as FieldKey[]);
    }

    const selectedFields = parseFields(fieldsParam);
    const headerRow = selectedFields.map((key) => availableFields[key].label);

    const dataRows: string[][] = [];
    let currentCityCSV = '';

    registrations.forEach((reg, index) => {
      const regCity = (reg.city || 'INDADEFINIDA').toUpperCase();
      if (regCity !== currentCityCSV) {
        currentCityCSV = regCity;
        if (dataRows.length > 0) {
          dataRows.push(new Array(selectedFields.length).fill(''));
        }
        const groupRow = new Array(selectedFields.length).fill('');
        groupRow[0] = `MUNICÍPIO: ${regCity}`;
        dataRows.push(groupRow);
      }

      const row = selectedFields.map((key) => {
        const value =
          key === 'number' ? index + 1 : availableFields[key].getter(reg);
        return value === null || value === undefined ? '' : String(value);
      });
      dataRows.push(row);
    });

    const sanitizedTitle = (event.title + (filenameSuffix || ''))
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();

    const formatType =
      formatParam === 'csv' || formatParam === 'pdf' ? formatParam : 'xlsx';

    if (formatType === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', margin: 40 }) as any;
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      const pdfPromise = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      doc.fontSize(16).text(`Relatório de Cadastros - ${event.title}`);
      if (filenameSuffix) {
        doc.fontSize(12).text(filenameSuffix.replace(/-/g, ' ').trim());
      }
      doc.moveDown();

      if (registrations.length === 0) {
        doc.fontSize(12).text('Nenhum cadastro encontrado.');
      } else {
        let currentCityPDF = '';
        registrations.forEach((registration, index) => {
          const regCity = (registration.city || 'INDADEFINIDA').toUpperCase();
          if (regCity !== currentCityPDF) {
            currentCityPDF = regCity;
            if (index > 0) doc.addPage();
            else doc.moveDown();
            doc
              .font('Helvetica-Bold')
              .fontSize(14)
              .fillColor('#003366')
              .text(`MUNICÍPIO: ${regCity}`);
            doc.fillColor('black').moveDown(0.5);
          }
          doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(`Participante ${index + 1}`);
          doc.moveDown(0.2);
          selectedFields.forEach((fieldKey) => {
            if (fieldKey === 'number') return;
            const descriptor = availableFields[fieldKey];
            const value = descriptor.getter(registration);
            doc
              .font('Helvetica')
              .fontSize(11)
              .text(`${descriptor.label}: ${value ?? '-'}`);
          });
          doc.moveDown();
        });
      }
      doc.end();
      const pdfBuffer = await pdfPromise;
      return {
        buffer: pdfBuffer,
        contentType: 'application/pdf',
        filename: `cadastros-${sanitizedTitle}.pdf`,
      };
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cadastros');

    if (formatType === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
      const csvBuffer = Buffer.concat([
        Buffer.from('\uFEFF'),
        Buffer.from(csv, 'utf-8'),
      ]);
      return {
        buffer: csvBuffer,
        contentType: 'text/csv; charset=utf-8',
        filename: `cadastros-${sanitizedTitle}.csv`,
      };
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `cadastros-${sanitizedTitle}.xlsx`,
    };
  }

  async updateMunicipalityLimit(
    limitId: string,
    userId: string,
    userRole: string | undefined,
    body: { defaultLimit?: number },
  ) {
    this.assertAdmin(userRole);
    const limit = await this.municipalitiesRepository.findUniqueLimit({
      where: { id: limitId },
      include: {
        event: {
          select: { createdBy: true },
        },
      },
    });

    if (!limit) {
      throw new NotFoundException('Limite de município não encontrado');
    }

    if (userRole !== 'SUPER_ADMIN' && limit.event.createdBy !== userId) {
      throw new ForbiddenException('Não autorizado a alterar este limite');
    }
    return this.municipalitiesRepository.updateLimit({
      where: { id: limitId },
      data: {
        defaultLimit: body.defaultLimit,
      },
    });
  }

  async closeClass(
    classId: string,
    userId: string,
    userRole: string | undefined,
  ) {
    this.assertAdmin(userRole);
    const classItem = await this.municipalitiesRepository.findUniqueClass({
      where: { id: classId },
      include: {
        municipalityLimit: {
          include: {
            event: {
              select: { createdBy: true },
            },
          },
        },
      },
    });
    if (!classItem) {
      throw new NotFoundException('Turma não encontrada');
    }

    if (
      userRole !== 'SUPER_ADMIN' &&
      classItem.municipalityLimit.event.createdBy !== userId
    ) {
      throw new ForbiddenException('Não autorizado a encerrar esta turma');
    }
    if (classItem.status === MunicipalityClassStatus.CLOSED) {
      throw new ForbiddenException('Turma já está encerrada');
    }
    return this.municipalitiesRepository.updateClass({
      where: { id: classId },
      data: {
        status: MunicipalityClassStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }

  async deleteRegistration(
    registrationId: string,
    userId: string,
    userRole: string | undefined,
  ) {
    this.assertAdmin(userRole);

    const registration = await this.prisma.registration.findFirst({
      where: { id: registrationId },
      include: {
        event: {
          select: { createdBy: true },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Registro não encontrado');
    }

    if (userRole !== 'SUPER_ADMIN' && registration.event.createdBy !== userId) {
      throw new ForbiddenException('Não autorizado a excluir este registro');
    }

    // Se estiver em uma turma, decrementa o contador
    if (registration.municipalityClassId) {
      await this.municipalitiesRepository.updateClass({
        where: { id: registration.municipalityClassId },
        data: {
          currentCount: { decrement: 1 },
        },
      });
    }

    await this.prisma.registration.delete({ where: { id: registrationId } });

    return { success: true };
  }
}
