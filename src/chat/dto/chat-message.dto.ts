export class ChatMessageDto {
  id: string;
  conversationId: string;
  clientId?: string;
  externalId?: string;
  direction: 'in' | 'out';
  content: string;
  messageType?: string;
  mediaUrl?: string;
  status?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}
