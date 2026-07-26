import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';
import { ForbiddenException } from '@nestjs/common';

describe('EventsService', () => {
  let service: EventsService;

  const txEventCreate = jest.fn();
  const txMunicipalityCreateMany = jest.fn();
  const transactionMock = jest.fn(async (fn: any) =>
    fn({
      event: { create: txEventCreate },
      municipalityLimit: { createMany: txMunicipalityCreateMany },
    }),
  );

  const mockEventsRepository = {
    transaction: transactionMock,
    findUnique: jest.fn(),
    findMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: EventsRepository, useValue: mockEventsRepository },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEvent', () => {
    it('should fail if user is not ADMIN', async () => {
      await expect(
        service.createEvent('user-id', 'USER', { title: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should auto-generate linkId', async () => {
      txEventCreate.mockResolvedValue({
        id: 'event-id',
        title: 'Test Event',
      });

      await service.createEvent('user-id', 'ADMIN', {
        title: 'Test Event',
      });

      expect(txEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linkId: expect.stringMatching(/^evt-/),
          }),
        }),
      );
    });

    it('should persist an optional groupInviteLink', async () => {
      txEventCreate.mockResolvedValue({
        id: 'event-id',
        title: 'Test Event',
        groupInviteLink: 'https://chat.whatsapp.com/invite-link',
      });

      await service.createEvent('user-id', 'ADMIN', {
        title: 'Test Event',
        groupInviteLink: 'https://chat.whatsapp.com/invite-link',
      });

      expect(txEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            groupInviteLink: 'https://chat.whatsapp.com/invite-link',
          }),
        }),
      );
    });
  });

  describe('getEventByLink', () => {
    it('should return the group invite link for the public event', async () => {
      mockEventsRepository.findUnique.mockResolvedValue({
        id: 'event-id',
        title: 'Test Event',
        status: 'ACTIVE',
        groupInviteLink: 'https://chat.whatsapp.com/invite-link',
      });

      const result = await service.getEventByLink('evt-123');

      expect(result).toEqual(
        expect.objectContaining({
          groupInviteLink: 'https://chat.whatsapp.com/invite-link',
        }),
      );
    });

    it('should filter out cities marked as hidden from formCities', async () => {
      mockEventsRepository.findUnique.mockResolvedValue({
        id: 'event-id',
        title: 'Test Event',
        status: 'ACTIVE',
        formCities: [
          { city: 'Fortaleza', state: 'CE' },
          { city: 'Sobral', state: 'CE', hidden: true },
        ],
      });

      const result = await service.getEventByLink('evt-123');

      expect(result.formCities).toEqual([{ city: 'Fortaleza', state: 'CE' }]);
    });
  });

  describe('getEventBySlug', () => {
    it('should filter out cities marked as hidden from formCities', async () => {
      mockEventsRepository.findUnique.mockResolvedValue({
        id: 'event-id',
        title: 'Test Event',
        status: 'ACTIVE',
        slug: 'evento-teste',
        formCities: [
          { city: 'Fortaleza', state: 'CE' },
          { city: 'Sobral', state: 'CE', hidden: true },
        ],
      });

      const result = await service.getEventBySlug('evento-teste');

      expect(result.formCities).toEqual([{ city: 'Fortaleza', state: 'CE' }]);
    });
  });
});
