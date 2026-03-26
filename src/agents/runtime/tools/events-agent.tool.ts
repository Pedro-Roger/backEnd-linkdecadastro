import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AgentChatResponse,
  AgentToolDefinition,
  AgentToolExecutionContext,
  CreateEntityActionPayload,
} from '../contracts/agent-runtime.types';
import { makeUniqueSlug, slugify } from '../utils/agent-text.utils';

@Injectable()
export class EventsAgentTool implements AgentToolDefinition {
  name = 'create_event';
  description = 'Cria eventos administrativos com limite, slug e banner opcional.';

  constructor(private readonly prisma: PrismaService) {}

  supports(actionType: 'create_event' | 'create_course') {
    return actionType === 'create_event';
  }

  buildPendingCard(payload: CreateEntityActionPayload, config: any) {
    return {
      title: 'Novo evento em preparacao',
      subtitle: payload.name || 'Evento',
      status: 'pending' as const,
      fields: [
        {
          label: 'Limite',
          value: String(payload.limit || config.defaultMaxRegistrations || 1000),
        },
        { label: 'Slug', value: payload.slug || 'Automatico' },
        { label: 'Status', value: payload.status || 'ACTIVE' },
      ],
    };
  }

  buildAwaitingMediaResponse(
    payload: CreateEntityActionPayload,
    config: any,
  ): AgentChatResponse {
    return {
      message:
        'Se quiser, me envie agora a foto/banner do evento. Se preferir continuar sem imagem, responda "sem foto".',
      pendingAction: {
        type: 'create_event',
        payload,
      },
      actionCard: {
        title: 'Criacao de evento pendente',
        subtitle: payload.name || 'Novo evento',
        status: 'pending',
        fields: [
          {
            label: 'Limite',
            value: String(
              payload.limit || config.defaultMaxRegistrations || 1000,
            ),
          },
          { label: 'Slug', value: payload.slug || 'Automatico' },
        ],
      },
    };
  }

  async execute(
    payload: CreateEntityActionPayload,
    context: AgentToolExecutionContext,
  ): Promise<AgentChatResponse> {
    const title = payload.name?.trim();
    if (!title) {
      return {
        message:
          'Eu preciso do nome do evento para criar. Exemplo: crie um evento com nome "Workshop de Vendas".',
      };
    }

    const slug = payload.slug || makeUniqueSlug(title);
    const maxRegistrations =
      payload.limit || context.config.defaultMaxRegistrations || 1000;
    const linkId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const event = await this.prisma.event.create({
      data: {
        title,
        description:
          payload.description ||
          `Evento criado pelo AI Assist em ${new Date().toLocaleString('pt-BR')}.`,
        slug: slugify(slug),
        linkId,
        maxRegistrations,
        bannerUrl: context.mediaUrl || null,
        status: (payload.status || 'ACTIVE') as any,
        createdBy: context.userId,
      },
    });

    const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/e/${event.slug || event.linkId}`;

    return {
      message: `Evento criado com sucesso.\n\nNome: ${event.title}\nLimite: ${event.maxRegistrations || 1000} pessoas\nLink do formulario: ${link}`,
      actionCard: {
        title: 'Evento criado',
        subtitle: event.title,
        status: 'completed',
        link,
        fields: [
          { label: 'Status', value: event.status },
          { label: 'Limite', value: String(event.maxRegistrations || 1000) },
          { label: 'Slug', value: event.slug || event.linkId },
          {
            label: 'Banner',
            value: context.mediaUrl ? 'Com imagem' : 'Sem imagem',
          },
        ],
      },
      action: {
        type: 'create_event',
        eventId: event.id,
        link,
      },
    };
  }
}
