export class ChannelStatusDto {
  status: 'connected' | 'disconnected' | 'connecting';
  phoneNumber?: string;
  profileName?: string;
  profilePicUrl?: string;
  stats?: {
    messages: number;
    contacts: number;
    chats: number;
  };
  lastSync?: Date;
}
