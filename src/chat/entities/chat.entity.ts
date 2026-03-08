export class ChatChannel {
  id: string;
  company_id: string;
  name?: string;
  instance_name: string;
  provider: string;
  phone_number?: string;
  status: string;
  settings?: any;
  is_notification_only?: boolean;
  last_sync?: Date;
  instance_server_id?: string;
  instances_server?: any;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

export class ChatConversation {
  id: string;
  channel_id: string;
  client_id?: string;
  user_id?: string;
  provider_uid: string;
  contact_name?: string;
  last_message?: string;
  last_message_at?: Date;
  unread_count?: number;
  is_archived?: boolean;
  profile_pic_url?: string;
  push_name?: string;
  metadata?: any;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
  clients?: {
    razao_social: string;
    nome_fantasia?: string;
    celular?: string;
    email_principal?: string;
  };
  users?: {
    id: string;
    name: string;
    email: string;
  };
}

export class ChatMessage {
  id: string;
  conversation_id: string;
  client_id?: string;
  external_id?: string;
  direction: string;
  content: string;
  message_type?: string;
  media_url?: string;
  status?: string;
  error_message?: string;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  participant_id?: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

export class QuickResponse {
  id: string;
  company_id: string;
  shortcut: string;
  name?: string;
  content: string;
  media_url?: string;
  active?: boolean;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}
