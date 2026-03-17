import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiChatService } from './ai-chat.service';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let prismaService: PrismaService;
  let aiChatService: AiChatService;

  const mockPrismaService = {
    chatChannel: {
      update: jest.fn(),
      create: jest.fn(),
    },
    chatChannelMember: {
      create: jest.fn(),
    },
    chatConversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    registration: {
      findMany: jest.fn(),
    },
  };

  const mockAiChatService = {
    consultarAssistente: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AiChatService,
          useValue: mockAiChatService,
        },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    prismaService = module.get<PrismaService>(PrismaService);
    aiChatService = module.get<AiChatService>(AiChatService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('getInstance', () => {
    it('deve criar uma nova instância se ela não existir', () => {
      const sessionId = 'test-session';
      // @ts-ignore - acessando método privado para teste
      const instance = service.getInstance(sessionId);
      expect(instance).toBeDefined();
      expect(instance.status).toBe('DISCONNECTED');
    });
  });
});
