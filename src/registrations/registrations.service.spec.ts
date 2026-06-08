import { ConflictException } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { EventCityService } from '../event-city/event-city.service';

describe('RegistrationsService', () => {
  const createService = () => {
    const prisma: any = {
      registration: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    const emailService: any = {
      sendRegistrationEmail: jest.fn(),
      sendAdminNotificationEmail: jest.fn(),
    };

    const whatsappService: any = {
      sendMessageToPhone: jest.fn(),
    };

    const cityService: any = {
      reserveSlot: jest.fn().mockResolvedValue(undefined),
    };

    const service = new RegistrationsService(
      prisma,
      emailService,
      whatsappService,
      cityService,
    );

    return { service, prisma, cityService };
  };

  it('returns prefill data and duplicate event details when CPF is already registered in the event', async () => {
    const { service, prisma } = createService();
    const createdAt = new Date('2026-03-24T12:00:00.000Z');

    prisma.registration.findFirst
      .mockResolvedValueOnce({
        id: 'registration-1',
        createdAt,
      })
      .mockResolvedValueOnce({
        name: 'Joao Teste',
        email: 'joao@example.com',
        phone: '82999999999',
        cep: '57000000',
        state: 'AL',
        city: 'Maceio',
        locality: 'Centro',
        participantType: 'PRODUTOR',
        otherType: null,
        pondCount: 2,
        waterArea: 1.5,
      });

    const result = await service.findByCpf('12345678901', 'event-1');

    expect(result).toEqual({
      profile: expect.objectContaining({
        name: 'Joao Teste',
        email: 'joao@example.com',
        phone: '82999999999',
        city: 'Maceio',
      }),
      existingRegistration: {
        id: 'registration-1',
        createdAt,
      },
    });
  });

  it('throws ConflictException when city registration is closed', async () => {
    const { service, prisma, cityService } = createService();
    prisma.registration.findFirst.mockResolvedValue(null);
    cityService.reserveSlot.mockRejectedValue(
      new ConflictException('Inscrições encerradas para esta cidade.'),
    );

    await expect(
      service.createRegistration({
        eventId: 'ev-1',
        name: 'João',
        cpf: '11122233344',
        phone: '85999999999',
        email: 'joao@test.com',
        cep: '60000000',
        locality: 'Centro',
        city: 'Fortaleza',
        state: 'CE',
        participantType: 'PRODUTOR' as any,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns duplicate registration metadata instead of throwing a generic error', async () => {
    const { service, prisma } = createService();
    const createdAt = new Date('2026-03-24T12:00:00.000Z');

    prisma.registration.findFirst.mockResolvedValue({
      id: 'registration-1',
      createdAt,
      status: 'CONFIRMED',
    });

    const result = await service.createRegistration({
      eventId: 'event-1',
      name: 'Joao Teste',
      cpf: '12345678901',
      phone: '82999999999',
      email: 'joao@example.com',
      cep: '57000000',
      locality: 'Centro',
      city: 'Maceio',
      state: 'AL',
      participantType: 'PRODUTOR',
      pondCount: 2,
      waterArea: 1.5,
    });

    expect(result).toEqual({
      error: {
        message: expect.stringContaining('inscrito neste evento'),
        status: 409,
        existingRegistration: {
          id: 'registration-1',
          status: 'CONFIRMED',
          createdAt,
        },
      },
    });
  });
});

