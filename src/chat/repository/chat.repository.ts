import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatChannel, ChatConversation, ChatMessage, QuickResponse } from '../entities/chat.entity';

export interface ChatConversationsQueryDto {
  channelId?: string;
  search?: string;
  unreadOnly?: boolean;
  isArchived?: boolean;
  assignedUserId?: string;
  unassigned?: boolean;
  page?: number;
  limit?: number;
}
export interface PaginationQueryDto {
  page?: number;
  limit?: number;
}

export interface IChatRepository {
  findByCompanyId(companyId: string, provider: string): Promise<ChatChannel | null>;
  findManyByCompanyIdAndProvider(companyId: string, provider: string): Promise<ChatChannel[]>;
  findManyByCompanyIdAndProviderWithAccess(companyId: string, provider: string, userId: string): Promise<ChatChannel[]>;
  findByInstanceName(instanceName: string): Promise<ChatChannel | null>;
  findById(id: string): Promise<ChatChannel | null>;
  create(data: Partial<ChatChannel>): Promise<ChatChannel>;
  update(id: string, data: Partial<ChatChannel>): Promise<ChatChannel>;
  upsertByCompanyId(companyId: string, provider: string, data: Partial<ChatChannel>): Promise<ChatChannel>;
  delete(id: string): Promise<ChatChannel>;
  findConversation(channelId: string, providerUid: string): Promise<ChatConversation | null>;
  upsertConversation(data: any): Promise<ChatConversation>;
  createMessage(data: any): Promise<ChatMessage>;
  listConversations(instanceId: string | string[], searchParams?: ChatConversationsQueryDto): Promise<[ChatConversation[], number]>;
  listMessages(conversationId: string, pagination?: PaginationQueryDto): Promise<[ChatMessage[], number]>;
  updateMessage(id: string, data: Partial<ChatMessage>): Promise<ChatMessage>;
  updateConversation(id: string, data: any): Promise<ChatConversation>;
  listQuickResponses(companyId: string): Promise<QuickResponse[]>;
  createQuickResponse(companyId: string, data: any): Promise<QuickResponse>;
  updateQuickResponse(id: string, companyId: string, data: any): Promise<QuickResponse>;
  deleteQuickResponse(id: string, companyId: string): Promise<QuickResponse>;
  linkClient(conversationId: string, clientId: string): Promise<ChatConversation>;
  addChannelMember(channelId: string, userId: string): Promise<any>;
  removeChannelMember(channelId: string, userId: string): Promise<any>;
  getChannelMembers(channelId: string): Promise<any[]>;
}

@Injectable()
export class ChatRepository implements IChatRepository {
  constructor(private readonly prisma: PrismaService) { }

  async listConversations(channelId: string | string[], searchParams?: ChatConversationsQueryDto): Promise<[ChatConversation[], number]> {
    const where: any = {};
    if (Array.isArray(channelId)) {
      where.channel_id = { in: channelId };
    } else {
      where.channel_id = channelId;
    }
    if (searchParams?.search) {
      where.OR = [
        { contact_name: { contains: searchParams.search, mode: 'insensitive' } },
        { provider_uid: { contains: searchParams.search, mode: 'insensitive' } },
      ];
    }
    if (searchParams?.unreadOnly) {
      where.unread_count = { gt: 0 };
    }
    if (searchParams?.isArchived !== undefined) {
      where.is_archived = searchParams.isArchived;
    }
    if (searchParams?.assignedUserId) {
      where.user_id = searchParams.assignedUserId;
    }
    if (searchParams?.unassigned) {
      where.user_id = null;
    }

    const skip = searchParams?.page && searchParams?.limit ? (searchParams.page - 1) * searchParams.limit : undefined;
    const take = searchParams?.limit ? parseInt(String(searchParams.limit)) : undefined;

    const [data, total] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        include: { users: { select: { id: true, name: true, email: true } } },
        orderBy: { last_message_at: 'desc' },
        skip,
        take,
      }),
      this.prisma.chatConversation.count({ where }),
    ]);

    return [data as any[], total];
  }

  async listMessages(conversationId: string, pagination?: PaginationQueryDto): Promise<[ChatMessage[], number]> {
    const skip = pagination?.page && pagination?.limit ? (pagination.page - 1) * pagination.limit : 0;
    const limit = pagination?.limit ? parseInt(String(pagination.limit)) : 50;
    const [docs, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { conversation_id: conversationId },
        orderBy: { sent_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.chatMessage.count({ where: { conversation_id: conversationId } }),
    ]);
    return [docs as any, total];
  }

  async findConversation(channelId: string, providerUid: string): Promise<ChatConversation | null> {
    return this.prisma.chatConversation.findFirst({
      where: { channel_id: channelId, provider_uid: providerUid },
    }) as any;
  }

  async upsertConversation(data: any): Promise<ChatConversation> {
    const { channel_id, provider_uid, ...rest } = data;
    const existing = await this.prisma.chatConversation.findFirst({
      where: { channel_id, provider_uid },
    });
    if (existing) {
      return this.prisma.chatConversation.update({
        where: { id: existing.id },
        data: { ...rest, updated_at: new Date() },
      }) as any;
    }
    const targetUserId = rest.user_id; // Default logic without channel members for now
    return this.prisma.chatConversation.create({
      data: {
        ...rest,
        channel_id,
        provider_uid,
        user_id: targetUserId,
        unread_count: typeof rest.unread_count === 'object' ? 1 : rest.unread_count || 0,
      },
    }) as any;
  }

  async updateConversation(id: string, data: any): Promise<ChatConversation> {
    return this.prisma.chatConversation.update({ where: { id }, data: data as any }) as any;
  }

  async createMessage(data: any): Promise<ChatMessage> {
    return this.prisma.chatMessage.create({
      data: { ...data, sent_at: data.sent_at || new Date() },
    }) as any;
  }

  async updateMessage(id: string, data: Partial<ChatMessage>): Promise<ChatMessage> {
    return this.prisma.chatMessage.update({
      where: { id },
      data: { ...data, updated_at: new Date() } as any,
    }) as any;
  }

  async findByCompanyId(companyId: string, provider: string): Promise<ChatChannel | null> {
    if (!companyId) return null;
    return this.prisma.chatChannel.findFirst({
      where: { company_id: companyId, provider: provider, deleted_at: null },
    }) as any;
  }

  async findManyByCompanyIdAndProvider(companyId: string, provider: string): Promise<ChatChannel[]> {
    if (!companyId) return [];
    return this.prisma.chatChannel.findMany({
      where: { company_id: companyId, provider: provider, deleted_at: null },
      orderBy: { created_at: 'desc' },
    }) as any;
  }

  async findManyByCompanyIdAndProviderWithAccess(companyId: string, provider: string, userId: string): Promise<ChatChannel[]> {
    if (!companyId) return [];
    return this.prisma.chatChannel.findMany({
      where: {
        company_id: companyId, provider: provider, deleted_at: null,
        AND: [
          { OR: [{ chat_channel_members: { none: { deleted_at: null } } }, { chat_channel_members: { some: { user_id: userId, deleted_at: null } } }] }
        ],
      },
      orderBy: { created_at: 'desc' },
    }) as any;
  }

  async findByInstanceName(instanceName: string): Promise<ChatChannel | null> {
    return this.prisma.chatChannel.findFirst({ where: { instance_name: instanceName } }) as any;
  }

  async findById(id: string): Promise<ChatChannel | null> {
    return this.prisma.chatChannel.findUnique({ where: { id } }) as any;
  }

  async create(data: Partial<ChatChannel>): Promise<ChatChannel> {
    const { chat_channel_members, chat_conversations, instances_server, settings, ...rest } = data as any;
    return this.prisma.chatChannel.create({
      data: {
        ...rest, settings: settings ? JSON.parse(JSON.stringify(settings)) : undefined
      } as any
    }) as any;
  }

  async update(id: string, data: Partial<ChatChannel>): Promise<ChatChannel> {
    const { chat_channel_members, chat_conversations, instances_server, settings, ...rest } = data as any;
    return this.prisma.chatChannel.update({
      where: { id },
      data: { ...rest, settings: settings ? JSON.parse(JSON.stringify(settings)) : undefined, updated_at: new Date() } as any,
    }) as any;
  }

  async upsertByCompanyId(companyId: string, provider: string, data: Partial<ChatChannel>): Promise<ChatChannel> {
    const existing = await this.findByCompanyId(companyId, provider);
    if (existing) return await this.update(existing.id, data);
    return await this.create({ ...data, company_id: companyId, provider: provider });
  }

  async delete(id: string): Promise<ChatChannel> {
    return this.prisma.chatChannel.delete({ where: { id } }) as any;
  }

  async listQuickResponses(companyId: string): Promise<QuickResponse[]> {
    return this.prisma.chatQuickResponse.findMany({ where: { company_id: companyId, deleted_at: null } }) as any;
  }

  async createQuickResponse(companyId: string, data: any): Promise<QuickResponse> {
    return this.prisma.chatQuickResponse.create({ data: { ...data, company_id: companyId } }) as any;
  }

  async updateQuickResponse(id: string, companyId: string, data: any): Promise<QuickResponse> {
    return this.prisma.chatQuickResponse.update({ where: { id, company_id: companyId }, data: { ...data, updated_at: new Date() } }) as any;
  }

  async deleteQuickResponse(id: string, companyId: string): Promise<QuickResponse> {
    return this.prisma.chatQuickResponse.update({ where: { id, company_id: companyId }, data: { deleted_at: new Date() } }) as any;
  }

  async linkClient(conversationId: string, clientId: string): Promise<ChatConversation> {
    return this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { client_id: clientId },
    }) as any;
  }

  async addChannelMember(channelId: string, userId: string): Promise<any> {
    const existing = await this.prisma.chatChannelMember.findFirst({
      where: { channel_id: channelId, user_id: userId, deleted_at: null },
    });
    if (existing) return existing;
    return this.prisma.chatChannelMember.create({ data: { channel_id: channelId, user_id: userId } });
  }

  async removeChannelMember(channelId: string, userId: string): Promise<any> {
    return this.prisma.chatChannelMember.deleteMany({
      where: { channel_id: channelId, user_id: userId },
    });
  }

  async getChannelMembers(channelId: string): Promise<any[]> {
    return this.prisma.chatChannelMember.findMany({
      where: { channel_id: channelId, deleted_at: null },
      include: { users: { select: { id: true, name: true, email: true } } },
    });
  }
}
