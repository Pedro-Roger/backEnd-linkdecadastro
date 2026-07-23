import { Test, TestingModule } from '@nestjs/testing';
import { AdminEventsService } from './admin-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsRepository } from '../events/events.repository';
import { RegistrationsRepository } from '../registrations/registrations.repository';
import { MunicipalitiesRepository } from '../events/municipalities.repository';
import { NotFoundException } from '@nestjs/common';

describe('AdminEventsService', () => {
  let service: AdminEventsService;

  const mockEventsRepository = {
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
    findUnique: jest.fn(),
  };

  const mockRegistrationsRepository = {
    count: jest.fn(),
  };

  const mockMunicipalitiesRepository = {
    findManyLimits: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEventsService,
        { provide: PrismaService, useValue: {} },
        { provide: EventsRepository, useValue: mockEventsRepository },
        { provide: RegistrationsRepository, useValue: mockRegistrationsRepository },
        { provide: MunicipalitiesRepository, useValue: mockMunicipalitiesRepository },
      ],
    }).compile();

    service = module.get<AdminEventsService>(AdminEventsService);
    jest.clearAllMocks();
  });

  it('persists groupInviteLink when updating an event', async () => {
    mockEventsRepository.findFirst.mockResolvedValue({ id: 'event-1' });
    mockEventsRepository.update.mockResolvedValue({
      id: 'event-1',
      groupInviteLink: 'https://chat.whatsapp.com/invite-link',
    });

    await service.updateEvent('event-1', 'user-1', 'ADMIN', {
      groupInviteLink: 'https://chat.whatsapp.com/invite-link',
    });

    expect(mockEventsRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupInviteLink: 'https://chat.whatsapp.com/invite-link',
        }),
      }),
    );
  });

  it('throws when the event is missing or inaccessible', async () => {
    mockEventsRepository.findFirst.mockResolvedValue(null);

    await expect(
      service.updateEvent('event-1', 'user-1', 'ADMIN', {}),
    ).rejects.toThrow(NotFoundException);
  });
});
