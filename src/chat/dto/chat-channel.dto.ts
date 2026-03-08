export class ChatChannelDto {
  id: string;
  companyId: string;
  instanceName: string;
  phoneNumber?: string;
  status: 'connected' | 'disconnected' | 'connecting';
  profileName?: string;
  profilePicUrl?: string;
  stats?: any;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}
