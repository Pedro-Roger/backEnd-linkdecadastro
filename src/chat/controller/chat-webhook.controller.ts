import { Controller, Post, Body, Logger, Inject, Param } from '@nestjs/common';
import { Services } from '../chat.constants';
import { ChatService } from '../services/chat.service';

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: any;
  sender?: string;
  destination?: string;
  date_time?: string;
}

@Controller('webhooks/chat')
export class ChatWebhookController {
  private readonly logger = new Logger(ChatWebhookController.name);

  constructor(
    @Inject(Services.CHAT_SERVICE)
    private readonly chatService: ChatService,
  ) {
  }

  @Post(':type')
  async handleWebhook(
    @Param('type') type: string,
    @Body() payload: EvolutionWebhookPayload,
  ): Promise<{ received: boolean }> {
    return this.processWebhook(type, payload);
  }

  @Post(':type/:event')
  async handleWebhookWithEvent(
    @Param('type') type: string,
    @Param('event') event: string,
    @Body() payload: EvolutionWebhookPayload,
  ): Promise<{ received: boolean }> {
    return this.processWebhook(type, payload);
  }

  private async processWebhook(
    type: string,
    payload: EvolutionWebhookPayload,
  ): Promise<{ received: boolean }> {
    const normalizedType = type === 'whastsapp' ? 'whatsapp' : type;

    try {
      const { event, instance, data } = payload;

      if (!instance) {
        this.logger.warn(`Webhook for ${type} received without instance name`);
        return { received: true };
      }

      if (normalizedType !== 'whatsapp') {
        this.logger.warn(
          `Webhook received for unsupported type: ${normalizedType}`,
        );
        return { received: true };
      }

      switch (event) {
        case 'CONNECTION_UPDATE':
        case 'connection.update':
          await this.handleConnectionUpdate(instance, data);
          break;

        case 'QRCODE_UPDATED':
        case 'qrcode.updated':
          await this.handleQRCode(instance, data);
          break;

        case 'MESSAGES_UPSERT':
        case 'messages.upsert': {
          const messageData = data?.message || data;
          const key = messageData?.key || data?.key;
          const remoteJid = key?.remoteJid;

          if (remoteJid && remoteJid.includes('@g.us')) {
            break;
          }

          // In this project, we don't have SQS yet. 
          // We can handle the message directly or log it for now.
          this.logger.log(`Message received for instance ${instance}: ${JSON.stringify(data)}`);
          break;
        }

        default:
        // Unhandled events
      }

      return { received: true };
    } catch (error) {
      this.logger.error(
        `Error processing webhook: ${error.message}`,
        error.stack,
      );
      return { received: false };
    }
  }

  private async handleConnectionUpdate(
    instance: string,
    data: any,
  ): Promise<void> {
    const rawState = data?.state || data?.status;
    this.logger.log(`Connection update for ${instance}: ${rawState}`);

    const statusMap: Record<string, string> = {
      open: 'connected',
      close: 'disconnected',
      connecting: 'connecting',
      refused: 'disconnected',
    };

    const status = statusMap[rawState] || 'disconnected';
    if ((this.chatService as any).updateStatus) {
      await (this.chatService as any).updateStatus(instance, status as any);
    }
  }

  private async handleQRCode(instance: string, data: any): Promise<void> {
    this.logger.log(`QR code update for instance: ${instance}`);

    const qrCode = data?.qrcode?.base64 || data?.qrcode;

    if (qrCode && typeof qrCode === 'string') {
      if ((this.chatService as any).updateQRCode) {
        await (this.chatService as any).updateQRCode(instance, qrCode);
      }
    }
  }
}
