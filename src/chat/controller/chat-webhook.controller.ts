import { Controller, Post, Body, Logger, Inject, Param } from '@nestjs/common';
import { IChatService } from '../../chat/services/chat.service';
import { Services } from 'src/modules/shared/enum/services.enum';
import { IQueueChatService } from 'src/modules/queue/provider/queue-chat.service';
import { SQSMessageType } from 'src/modules/shared/enum/sqs.enum';

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
    private readonly chatService: IChatService,
    @Inject(Services.QUEUE_CHAT_SERVICE)
    private readonly queueChatService: IQueueChatService,
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
    // Handle typos in type (like 'whastsapp' seen in logs)
    const normalizedType = type === 'whastsapp' ? 'whatsapp' : type;

    try {
      const { event, instance, data } = payload;

      if (!instance) {
        this.logger.warn(`Webhook for ${type} received without instance name`);
        return { received: true };
      }

      // For now, we only handle WhatsApp (Evolution API) logic
      // If we add other types (Telegram, etc.), we would branch here
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
          // Checagem rápida para ignorar grupos (@g.us) e poupar requisições pro SQS
          const messageData = data?.message || data;
          const key = messageData?.key || data?.key;
          const remoteJid = key?.remoteJid;

          if (remoteJid && remoteJid.includes('@g.us')) {
            break;
          }

          await this.queueChatService.sendMessage({
            type: SQSMessageType.CHAT_MESSAGE,
            payload: {
              instance,
              data,
              type: normalizedType,
              // Campos extras do payload para resolução de LID (@lid → número real)
              sender: payload.sender,
              senderPn: (payload as any).senderPn || (data as any)?.senderPn,
            },
          });
          break;
        }

        case 'MESSAGES_UPDATE':
        case 'messages.update':
          // TODO: Update message status (read, delivered)
          break;

        case 'SEND_MESSAGE':
          break;

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
    this.logger.log(`Connection update for ${instance}: ${rawState} (Full data: ${JSON.stringify(data)})`);

    const statusMap = {
      open: 'connected',
      close: 'disconnected',
      connecting: 'connecting',
      refused: 'disconnected',
    };

    const status = statusMap[rawState] || 'disconnected';
    await this.chatService.updateStatus(instance, status as any);
  }

  private async handleQRCode(instance: string, data: any): Promise<void> {
    this.logger.log(`QR code update for instance: ${instance}`);

    const qrCode = data?.qrcode?.base64 || data?.qrcode;

    if (qrCode && typeof qrCode === 'string') {
      await this.chatService.updateQRCode(instance, qrCode);
    } else {
      this.logger.warn(
        `Could not extract QR code from payload: ${JSON.stringify(data)}`,
      );
    }
  }
}
