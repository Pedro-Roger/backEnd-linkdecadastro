import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { SetConversationRouteDto } from './dto/set-conversation-route.dto';

export type ConversationMode = 'HUMAN' | 'COPILOT' | 'AUTONOMOUS';

export interface ServiceAgent {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  description?: string;
  module: string;
  model: string;
  instructions: string;
  knowledge_base?: string;
  is_active: boolean;
  tools: string[];
  allowed_channel_ids: string[];
  bound_channel_id?: string | null;
  api_key?: string | null;
  api_key_label?: string | null;
  default_mode: ConversationMode;
  provider: string;
  provider_agent_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationRoute {
  id: string;
  conversation_id: string;
  channel_id: string;
  provider_uid: string;
  mode: ConversationMode;
  agent_id?: string | null;
  memory_summary?: string;
  last_intent?: string;
  updated_by_user_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ResolvedConversationAgent {
  conversationId?: string;
  mode: ConversationMode;
  agent: ServiceAgent | null;
  route: ConversationRoute | null;
}

const AGENTS_COLLECTION = 'service_agents';
const ROUTES_COLLECTION = 'service_agent_routes';
const ACCESS_COLLECTION = 'service_agent_accesses';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly availableTools = [
    'contact.lookup',
    'conversation.history',
    'crm.note.create',
    'task.create',
    'task.list',
    'pipeline.move',
    'whatsapp.send',
    'event.lookup',
    'course.lookup',
    'human.handoff',
  ];

  private isSuperAdmin(userRole?: string) {
    return String(userRole || '').toUpperCase() === 'SUPER_ADMIN';
  }

  private assertAdmin(userRole?: string) {
    const normalized = String(userRole || '').toUpperCase();
    if (normalized !== 'ADMIN' && normalized !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Acesso permitido apenas para administradores.');
    }
  }

  private assertMaster(userRole?: string) {
    if (!this.isSuperAdmin(userRole)) {
      throw new ForbiddenException('Apenas o SUPER_ADMIN pode gerenciar agentes.');
    }
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 120);
  }

  private async runCommand<T = any>(command: Record<string, unknown>): Promise<T> {
    return (this.prisma as any).$runCommandRaw(command);
  }

  private async findMany<T>(collection: string, filter: Record<string, unknown>, sort?: Record<string, 1 | -1>) {
    const result = await this.runCommand<{ cursor?: { firstBatch?: T[] } }>({
      find: collection,
      filter,
      sort: sort || { updated_at: -1 },
    });

    return result?.cursor?.firstBatch || [];
  }

  private async findOne<T>(collection: string, filter: Record<string, unknown>) {
    const items = await this.findMany<T>(collection, filter, { updated_at: -1 });
    return items[0] || null;
  }

  private async insertOne<T>(collection: string, document: T) {
    await this.runCommand({
      insert: collection,
      documents: [document],
    });

    return document;
  }

  private async updateOne(collection: string, filter: Record<string, unknown>, $set: Record<string, unknown>, upsert = false) {
    await this.runCommand({
      update: collection,
      updates: [
        {
          q: filter,
          u: { $set },
          upsert,
          multi: false,
        },
      ],
    });
  }

  private async deleteMany(collection: string, filter: Record<string, unknown>) {
    await this.runCommand({
      delete: collection,
      deletes: [
        {
          q: filter,
          limit: 0,
        },
      ],
    });
  }

  private sanitizeAgent(agent: Partial<ServiceAgent> | null) {
    if (!agent) return null;
    return {
      id: agent.id,
      ownerUserId: agent.owner_user_id,
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      module: agent.module,
      model: agent.model,
      instructions: agent.instructions,
      knowledgeBase: agent.knowledge_base,
      isActive: agent.is_active,
      tools: agent.tools || [],
      allowedChannelIds: agent.allowed_channel_ids || [],
      boundChannelId: agent.bound_channel_id || null,
      hasCustomApiKey: Boolean(agent.api_key),
      apiKeyLabel: agent.api_key_label || null,
      defaultMode: agent.default_mode,
      provider: agent.provider,
      providerAgentId: agent.provider_agent_id || null,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
    };
  }

  private sanitizeRoute(route: Partial<ConversationRoute> | null, agent?: Partial<ServiceAgent> | null) {
    if (!route) return null;
    return {
      id: route.id,
      conversationId: route.conversation_id,
      channelId: route.channel_id,
      providerUid: route.provider_uid,
      mode: route.mode,
      agentId: route.agent_id || null,
      memorySummary: route.memory_summary || '',
      lastIntent: route.last_intent || '',
      updatedByUserId: route.updated_by_user_id,
      createdAt: route.created_at,
      updatedAt: route.updated_at,
      agent: this.sanitizeAgent((agent as ServiceAgent) || null),
    };
  }

  private sanitizeAccess(access: any) {
    if (!access) return null;
    return {
      id: access.id,
      userId: access.user_id,
      enabled: access.enabled !== false,
      grantedByUserId: access.granted_by_user_id || null,
      createdAt: access.created_at,
      updatedAt: access.updated_at,
    };
  }

  async hasAgentAccess(userId: string, userRole?: string) {
    if (this.isSuperAdmin(userRole)) return true;

    const access = await this.findOne<any>(ACCESS_COLLECTION, {
      user_id: userId,
      enabled: true,
    });

    return Boolean(access);
  }

  getAvailableTools() {
    return this.availableTools.map((tool) => ({
      key: tool,
      enabledByDefault: ['contact.lookup', 'conversation.history', 'human.handoff'].includes(tool),
    }));
  }

  async listAgents(userId: string, userRole?: string, module?: string) {
    this.assertAdmin(userRole);
    const hasAccess = await this.hasAgentAccess(userId, userRole);
    if (!hasAccess) {
      return [];
    }
    const filter: Record<string, unknown> = {};

    if (!this.isSuperAdmin(userRole)) {
      filter.owner_user_id = { $exists: true };
      filter.is_active = true;
    }

    if (module) {
      filter.module = module;
    }

    const agents = await this.findMany<ServiceAgent>(AGENTS_COLLECTION, filter, {
      updated_at: -1,
    });

    return agents.map((agent) => this.sanitizeAgent(agent));
  }

  async getAgentById(agentId: string, userId: string, userRole?: string) {
    this.assertAdmin(userRole);
    const hasAccess = await this.hasAgentAccess(userId, userRole);
    if (!hasAccess) {
      throw new ForbiddenException('Voce nao possui acesso ao modulo de agentes.');
    }
    const agent = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, { id: agentId });

    if (!agent) {
      throw new NotFoundException('Agente não encontrado.');
    }

    if (!this.isSuperAdmin(userRole) && !agent.is_active) {
      throw new ForbiddenException('Agente indisponivel para sua conta.');
    }

    return this.sanitizeAgent(agent);
  }

  async createAgent(userId: string, userRole: string | undefined, body: CreateAgentDto) {
    this.assertMaster(userRole);

    const now = new Date();
    const slug = this.slugify(body.slug || body.name);
    const existing = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, {
      owner_user_id: userId,
      slug,
    });

    if (existing) {
      throw new BadRequestException('Já existe um agente com esse slug.');
    }

    const agent: ServiceAgent = {
      id: randomUUID(),
      owner_user_id: userId,
      name: body.name,
      slug,
      description: body.description?.trim(),
      module: body.module || 'atendimento',
      model: body.model || process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b',
      instructions: body.instructions?.trim() || 'Atue como um agente especialista do módulo de atendimento.',
      knowledge_base: body.knowledgeBase?.trim(),
      is_active: body.isActive ?? true,
      tools: (body.tools || []).filter((tool) => this.availableTools.includes(tool)),
      allowed_channel_ids: body.allowedChannelIds || [],
      bound_channel_id: body.boundChannelId || null,
      api_key: body.apiKey?.trim() || null,
      api_key_label: body.apiKeyLabel?.trim() || null,
      default_mode: body.defaultMode || 'COPILOT',
      provider: 'OPENAI_RESPONSES',
      provider_agent_id: null,
      created_at: now,
      updated_at: now,
    };

    await this.insertOne<ServiceAgent>(AGENTS_COLLECTION, agent);
    return this.sanitizeAgent(agent);
  }

  async updateAgent(agentId: string, userId: string, userRole: string | undefined, body: UpdateAgentDto) {
    this.assertMaster(userRole);
    const current = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, { id: agentId });

    if (!current) {
      throw new NotFoundException('Agente não encontrado.');
    }

    const nextSlug = body.slug || (body.name ? this.slugify(body.name) : current.slug);
    const conflicting = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, {
      owner_user_id: current.owner_user_id,
      slug: nextSlug,
    });

    if (conflicting && conflicting.id !== current.id) {
      throw new BadRequestException('Já existe outro agente com esse slug.');
    }

    const patch: Partial<ServiceAgent> = {
      name: body.name ?? current.name,
      slug: nextSlug,
      description: body.description ?? current.description,
      module: body.module ?? current.module,
      model: body.model ?? current.model,
      instructions: body.instructions ?? current.instructions,
      knowledge_base: body.knowledgeBase ?? current.knowledge_base,
      is_active: body.isActive ?? current.is_active,
      tools: body.tools
        ? body.tools.filter((tool) => this.availableTools.includes(tool))
        : current.tools,
      allowed_channel_ids: body.allowedChannelIds ?? current.allowed_channel_ids,
      bound_channel_id: body.boundChannelId ?? current.bound_channel_id ?? null,
      api_key:
        body.apiKey !== undefined ? body.apiKey?.trim() || null : current.api_key ?? null,
      api_key_label:
        body.apiKeyLabel !== undefined
          ? body.apiKeyLabel?.trim() || null
          : current.api_key_label ?? null,
      default_mode: body.defaultMode ?? current.default_mode,
      updated_at: new Date(),
    };

    await this.updateOne(AGENTS_COLLECTION, { id: agentId }, patch as Record<string, unknown>);
    const updated = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, { id: agentId });
    return this.sanitizeAgent(updated);
  }

  async deleteAgent(agentId: string, userRole?: string) {
    this.assertMaster(userRole);

    const current = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, { id: agentId });

    if (!current) {
      throw new NotFoundException('Agente não encontrado.');
    }

    await this.updateOne(
      ROUTES_COLLECTION,
      { agent_id: agentId },
      {
        agent_id: null,
        mode: 'HUMAN',
        updated_at: new Date(),
      },
    );

    await this.deleteMany(AGENTS_COLLECTION, { id: agentId });

    return {
      success: true,
      deletedAgentId: agentId,
    };
  }

  private async assertConversationAccess(conversationId: string, userId: string, userRole?: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { channel: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    if (!this.isSuperAdmin(userRole)) {
      const membership = await this.prisma.chatChannelMember.findFirst({
        where: {
          channel_id: conversation.channel_id,
          user_id: userId,
          deleted_at: null,
        },
      });

      if (!membership) {
        throw new ForbiddenException('Você não tem acesso a esta conversa.');
      }
    }

    return conversation;
  }

  async listConversationRoutes(userId: string, userRole?: string, channelId?: string) {
    this.assertAdmin(userRole);
    const hasAccess = await this.hasAgentAccess(userId, userRole);
    if (!hasAccess) {
      return [];
    }

    let allowedChannelIds: string[] | undefined = undefined;
    if (!this.isSuperAdmin(userRole)) {
      const memberships = await this.prisma.chatChannelMember.findMany({
        where: { user_id: userId, deleted_at: null },
        select: { channel_id: true },
      });
      allowedChannelIds = memberships.map((item) => item.channel_id);
    }

    const filter: Record<string, unknown> = {};
    if (channelId) filter.channel_id = channelId;
    if (allowedChannelIds) {
      filter.channel_id = channelId || { $in: allowedChannelIds };
    }

    const routes = await this.findMany<ConversationRoute>(ROUTES_COLLECTION, filter, {
      updated_at: -1,
    });

    const agents = await this.findMany<ServiceAgent>(AGENTS_COLLECTION, {}, { updated_at: -1 });
    const agentsMap = new Map(agents.map((agent) => [agent.id, agent]));

    return routes.map((route) => this.sanitizeRoute(route, route.agent_id ? agentsMap.get(route.agent_id) || null : null));
  }

  async getConversationRoute(conversationId: string, userId: string, userRole?: string) {
    const hasAccess = await this.hasAgentAccess(userId, userRole);
    if (!hasAccess) {
      throw new ForbiddenException('Voce nao possui acesso ao modulo de agentes.');
    }
    const conversation = await this.assertConversationAccess(conversationId, userId, userRole);
    const route = await this.findOne<ConversationRoute>(ROUTES_COLLECTION, { conversation_id: conversation.id });

    if (!route) {
      return {
        conversationId: conversation.id,
        channelId: conversation.channel_id,
        providerUid: conversation.provider_uid,
        mode: 'HUMAN',
        agent: null,
        route: null,
      };
    }

    const agent = route.agent_id
      ? await this.findOne<ServiceAgent>(AGENTS_COLLECTION, { id: route.agent_id })
      : null;

    return this.sanitizeRoute(route, agent);
  }

  async setConversationRoute(conversationId: string, userId: string, userRole: string | undefined, body: SetConversationRouteDto) {
    this.assertAdmin(userRole);
    const hasAccess = await this.hasAgentAccess(userId, userRole);
    if (!hasAccess) {
      throw new ForbiddenException('Voce nao possui acesso ao modulo de agentes.');
    }
    const conversation = await this.assertConversationAccess(conversationId, userId, userRole);

    let agent: ServiceAgent | null = null;
    if (body.agentId) {
      const found = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, { id: body.agentId });
      if (!found) {
        throw new NotFoundException('Agente não encontrado para esta rota.');
      }
      if (!this.isSuperAdmin(userRole) && found.owner_user_id !== userId) {
        throw new ForbiddenException('Você não pode usar um agente que não pertence à sua conta.');
      }
      if (!found.is_active) {
        throw new BadRequestException('O agente selecionado está inativo.');
      }
      if (found.bound_channel_id && found.bound_channel_id !== conversation.channel_id) {
        throw new BadRequestException(
          'O agente selecionado está vinculado a outro número de WhatsApp.',
        );
      }
      agent = found;
    }

    if (body.mode === 'AUTONOMOUS' && !agent) {
      throw new BadRequestException('Modo autônomo exige um agente vinculado.');
    }

    const current = await this.findOne<ConversationRoute>(ROUTES_COLLECTION, {
      conversation_id: conversation.id,
    });

    const now = new Date();
    const route: ConversationRoute = {
      id: current?.id || randomUUID(),
      conversation_id: conversation.id,
      channel_id: conversation.channel_id,
      provider_uid: conversation.provider_uid,
      mode: body.mode,
      agent_id: agent?.id || null,
      memory_summary: body.memorySummary ?? current?.memory_summary ?? '',
      last_intent: body.lastIntent ?? current?.last_intent ?? '',
      updated_by_user_id: userId,
      created_at: current?.created_at || now,
      updated_at: now,
    };

    await this.updateOne(
      ROUTES_COLLECTION,
      { conversation_id: conversation.id },
      route as unknown as Record<string, unknown>,
      true,
    );

    return this.sanitizeRoute(route, agent);
  }

  async listAccesses(userRole?: string) {
    this.assertMaster(userRole);
    const accesses = await this.findMany<any>(ACCESS_COLLECTION, {}, {
      updated_at: -1,
    });
    return accesses.map((access) => this.sanitizeAccess(access));
  }

  async setUserAccess(
    targetUserId: string,
    enabled: boolean,
    grantedByUserId: string,
    userRole?: string,
  ) {
    this.assertMaster(userRole);

    const now = new Date();
    const current = await this.findOne<any>(ACCESS_COLLECTION, {
      user_id: targetUserId,
    });

    const next = {
      id: current?.id || randomUUID(),
      user_id: targetUserId,
      enabled,
      granted_by_user_id: grantedByUserId,
      created_at: current?.created_at || now,
      updated_at: now,
    };

    await this.updateOne(
      ACCESS_COLLECTION,
      { user_id: targetUserId },
      next,
      true,
    );

    return this.sanitizeAccess(next);
  }

  async getMyAccess(userId: string, userRole?: string) {
    const canAccessAgents = await this.hasAgentAccess(userId, userRole);
    return {
      canAccessAgents,
      isMaster: this.isSuperAdmin(userRole),
    };
  }

  async resolveConversationAgent(sessionId: string, providerUid: string): Promise<ResolvedConversationAgent> {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        channel_id: sessionId,
        provider_uid: providerUid,
      },
    });

    if (!conversation) {
      const channelBoundAgent = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, {
        bound_channel_id: sessionId,
        is_active: true,
      });

      return {
        mode: channelBoundAgent?.default_mode || 'HUMAN',
        agent: channelBoundAgent || null,
        route: null,
      };
    }

    const route = await this.findOne<ConversationRoute>(ROUTES_COLLECTION, {
      conversation_id: conversation.id,
    });

    if (!route) {
      const channelBoundAgent = await this.findOne<ServiceAgent>(AGENTS_COLLECTION, {
        bound_channel_id: sessionId,
        is_active: true,
      });

      return {
        conversationId: conversation.id,
        mode: channelBoundAgent?.default_mode || 'HUMAN',
        agent: channelBoundAgent || null,
        route: null,
      };
    }

    const agent = route.agent_id
      ? await this.findOne<ServiceAgent>(AGENTS_COLLECTION, {
          id: route.agent_id,
          is_active: true,
        })
      : null;

    return {
      conversationId: conversation.id,
      mode: route.mode,
      agent,
      route,
    };
  }
}
