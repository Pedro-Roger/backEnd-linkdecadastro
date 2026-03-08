export class ChatConversationDto {
  id: string;
  channelId: string;
  clientId?: string;
  contactName?: string;
  providerUid: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount?: number;
  client?: {
    name: string;
    celular?: string;
    email?: string;
  } | null;
}
