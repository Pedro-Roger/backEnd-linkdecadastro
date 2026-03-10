import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { AiChatService } from './ai-chat.service';

@Module({
  controllers: [WhatsAppController],
  providers: [WhatsAppService, AiChatService],
  exports: [WhatsAppService, AiChatService],
})
export class WhatsAppModule { }
