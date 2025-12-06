import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('EventsService', () => {
    let service: EventsService;
    let prisma: PrismaService;

    const mockPrismaService = {
        event: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventsService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<EventsService>(EventsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createEvent', () => {
        it('should create an event with valid data', async () => {
            const userId = 'user-id';
            const userRole = 'ADMIN';
            const body = {
                title: 'Test Event',
                description: 'Description',
                slug: 'test-event',
            };

            mockPrismaService.event.create.mockResolvedValue({ id: 'event-id', ...body });

            const result = await service.createEvent(userId, userRole, body);

            expect(prisma.event.create).toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({ id: 'event-id' }));
        });

        it('should fail if user is not ADMIN', async () => {
            const userId = 'user-id';
            const userRole = 'USER';
            const body = { title: 'Test' };

            await expect(service.createEvent(userId, userRole, body)).rejects.toThrow(ForbiddenException);
        });

        it('should sanitize slug if it contains spaces', async () => {
            const userId = 'user-id';
            const userRole = 'ADMIN';
            const body = {
                title: 'Test Event',
                slug: 'test event', // Should become 'test-event'
            };

            mockPrismaService.event.create.mockResolvedValue({ id: 'event-id', ...body, slug: 'test-event' });

            await service.createEvent(userId, userRole, body);

            expect(prisma.event.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    slug: 'test-event',
                })
            }));
        });

        it('should sanitize slug if it contains special characters', async () => {
            const userId = 'user-id';
            const userRole = 'ADMIN';
            const body = {
                title: 'Test Event',
                slug: 'test@event!', // Should become 'test-event'
            };

            mockPrismaService.event.create.mockResolvedValue({ id: 'event-id', ...body, slug: 'test-event' });

            await service.createEvent(userId, userRole, body);

            expect(prisma.event.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    slug: 'test-event',
                })
            }));
        });
        it('should auto-generate linkId', async () => {
            const userId = 'user-id';
            const userRole = 'ADMIN';
            const body = {
                title: 'Test Event',
            };

            mockPrismaService.event.create.mockResolvedValue({ id: 'event-id', ...body });

            await service.createEvent(userId, userRole, body);

            expect(prisma.event.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    linkId: expect.stringMatching(/^evt-/),
                })
            }));
        });
    });
});
