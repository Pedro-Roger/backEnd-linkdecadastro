import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { AiChatService } from './ai-chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';
import { WhatsAppBotContextService } from './whatsapp-bot-context.service';
import { WhatsAppMessageRouterService } from './whatsapp-message-router.service';
import { WhatsAppProactiveFollowupService } from './whatsapp-proactive-followup.service';

@Module({
  imports: [PrismaModule, AgentsModule],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    AiChatService,
    WhatsAppBotContextService,
    WhatsAppMessageRouterService,
    WhatsAppProactiveFollowupService,
  ],
  exports: [
    WhatsAppService,
    AiChatService,
    WhatsAppBotContextService,
    WhatsAppMessageRouterService,
    WhatsAppProactiveFollowupService,
  ],
})
export class WhatsAppModule { }
