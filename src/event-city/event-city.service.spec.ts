import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventCityService } from './event-city.service';

const makePrisma = () => ({
  municipalityLimit: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
});

describe('EventCityService', () => {
  describe('getStatus', () => {
    it('returns CLOSED when isClosed is true', () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: true, defaultLimit: 10, registrationCount: 0 };
      expect((svc as any).getStatus(ec)).toBe('CLOSED');
    });

    it('returns FULL when registrationCount >= defaultLimit', () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: false, defaultLimit: 5, registrationCount: 5 };
      expect((svc as any).getStatus(ec)).toBe('FULL');
    });

    it('returns OPEN when there are vacancies and not closed', () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: false, defaultLimit: 10, registrationCount: 3 };
      expect((svc as any).getStatus(ec)).toBe('OPEN');
    });

    it('returns OPEN when defaultLimit is 0 meaning unlimited', () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: false, defaultLimit: 0, registrationCount: 999 };
      expect((svc as any).getStatus(ec)).toBe('OPEN');
    });
  });

  describe('listAvailable', () => {
    it('returns city list with computed status and message', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findMany.mockResolvedValue([
        { id: '1', municipality: 'Fortaleza', state: 'CE', isClosed: false, defaultLimit: 100, registrationCount: 20, closedMessage: null },
        { id: '2', municipality: 'Sobral',    state: 'CE', isClosed: false, defaultLimit: 5,   registrationCount: 5,  closedMessage: 'Vagas esgotadas.' },
        { id: '3', municipality: 'Juazeiro',  state: 'CE', isClosed: true,  defaultLimit: 50,  registrationCount: 10, closedMessage: 'Encerrado pelo admin.' },
      ]);
      const svc = new EventCityService(prisma as any);
      const result = await svc.listAvailable('event-1');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: '1', municipality: 'Fortaleza', state: 'CE', status: 'OPEN',   message: null });
      expect(result[1]).toEqual({ id: '2', municipality: 'Sobral',    state: 'CE', status: 'FULL',   message: 'Vagas esgotadas.' });
      expect(result[2]).toEqual({ id: '3', municipality: 'Juazeiro',  state: 'CE', status: 'CLOSED', message: 'Encerrado pelo admin.' });
    });
  });

  describe('reserveSlot', () => {
    it('throws NotFoundException when city not found', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue(null);
      const svc = new EventCityService(prisma as any);
      await expect(svc.reserveSlot('event-1', 'Fortaleza', 'CE')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException with message when city is closed', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: '1', isClosed: true, defaultLimit: 10, registrationCount: 0, closedMessage: 'Encerrado.',
      });
      const svc = new EventCityService(prisma as any);
      await expect(svc.reserveSlot('event-1', 'Fortaleza', 'CE')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when city is full', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: '1', isClosed: false, defaultLimit: 5, registrationCount: 5, closedMessage: null,
      });
      const svc = new EventCityService(prisma as any);
      await expect(svc.reserveSlot('event-1', 'Fortaleza', 'CE')).rejects.toThrow(ConflictException);
    });

    it('treats null registrationCount as 0 — legacy records without the field still get OPEN status', async () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: false, defaultLimit: 10, registrationCount: null };
      expect((svc as any).getStatus(ec)).toBe('OPEN');
    });

    it('reserves slot for legacy record without registrationCount using OR condition', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: 'legacy-1', isClosed: false, isClosed: false, defaultLimit: 10, registrationCount: null, closedMessage: null,
      });
      prisma.municipalityLimit.updateMany.mockResolvedValue({ count: 1 });
      const svc = new EventCityService(prisma as any);
      await svc.reserveSlot('event-1', 'Fortaleza', 'CE');
      expect(prisma.municipalityLimit.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'legacy-1',
          OR: [
            { registrationCount: { lt: 10 } },
            { registrationCount: null },
          ],
          isClosed: false,
        },
        data: { registrationCount: { increment: 1 } },
      });
    });

    it('atomically increments registrationCount when slot is available', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: 'limit-1', isClosed: false, defaultLimit: 10, registrationCount: 3, closedMessage: null,
      });
      prisma.municipalityLimit.updateMany.mockResolvedValue({ count: 1 });
      const svc = new EventCityService(prisma as any);
      await svc.reserveSlot('event-1', 'Fortaleza', 'CE');
      expect(prisma.municipalityLimit.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'limit-1',
          OR: [
            { registrationCount: { lt: 10 } },
            { registrationCount: null },
          ],
          isClosed: false,
        },
        data: { registrationCount: { increment: 1 } },
      });
    });

    it('throws ConflictException when atomic update returns count 0 (race condition)', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: 'limit-1', isClosed: false, defaultLimit: 10, registrationCount: 9, closedMessage: null,
      });
      prisma.municipalityLimit.updateMany.mockResolvedValue({ count: 0 });
      const svc = new EventCityService(prisma as any);
      await expect(svc.reserveSlot('event-1', 'Fortaleza', 'CE')).rejects.toThrow(ConflictException);
    });

    it('skips limit check when defaultLimit is 0 (unlimited)', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: 'limit-1', isClosed: false, defaultLimit: 0, registrationCount: 999, closedMessage: null,
      });
      prisma.municipalityLimit.update.mockResolvedValue({});
      const svc = new EventCityService(prisma as any);
      await svc.reserveSlot('event-1', 'Fortaleza', 'CE');
      expect(prisma.municipalityLimit.update).toHaveBeenCalledWith({
        where: { id: 'limit-1' },
        data: { registrationCount: { increment: 1 } },
      });
    });
  });

  describe('updateStatus', () => {
    it('updates isClosed and closedMessage on the limit record', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.update.mockResolvedValue({ id: '1', isClosed: true, closedMessage: 'Encerrado.' });
      const svc = new EventCityService(prisma as any);
      const result = await svc.updateStatus('limit-1', { isClosed: true, closedMessage: 'Encerrado.' });
      expect(prisma.municipalityLimit.update).toHaveBeenCalledWith({
        where: { id: 'limit-1' },
        data: { isClosed: true, closedMessage: 'Encerrado.' },
      });
      expect(result.isClosed).toBe(true);
    });
  });

  describe('upsertCity', () => {
    it('creates a MunicipalityLimit when one does not exist', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue(null);
      prisma.municipalityLimit.create.mockResolvedValue({ id: 'new-1' });
      const svc = new EventCityService(prisma as any);
      await svc.upsertCity('event-1', { municipality: 'Fortaleza', state: 'CE', defaultLimit: 100 });
      expect(prisma.municipalityLimit.create).toHaveBeenCalledWith({
        data: { eventId: 'event-1', municipality: 'Fortaleza', state: 'CE', defaultLimit: 100 },
      });
    });

    it('updates defaultLimit when limit already exists', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({ id: 'existing-1', defaultLimit: 50 });
      prisma.municipalityLimit.update.mockResolvedValue({ id: 'existing-1' });
      const svc = new EventCityService(prisma as any);
      await svc.upsertCity('event-1', { municipality: 'Fortaleza', state: 'CE', defaultLimit: 200 });
      expect(prisma.municipalityLimit.update).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
        data: { defaultLimit: 200 },
      });
    });
  });
});
