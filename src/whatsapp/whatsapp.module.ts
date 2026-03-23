import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { AiChatService } from './ai-chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [PrismaModule, AgentsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, AiChatService],
  exports: [WhatsAppService, AiChatService],
})
export class WhatsAppModule { }
