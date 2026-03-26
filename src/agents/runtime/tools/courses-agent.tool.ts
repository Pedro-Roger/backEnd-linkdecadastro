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
export class CoursesAgentTool implements AgentToolDefinition {
  name = 'create_course';
  description =
    'Cria cursos administrativos com datas, limite de vagas e banner opcional.';

  constructor(private readonly prisma: PrismaService) {}

  supports(actionType: 'create_event' | 'create_course') {
    return actionType === 'create_course';
  }

  buildPendingCard(payload: CreateEntityActionPayload, config: any) {
    return {
      title: 'Novo curso em preparacao',
      subtitle: payload.name || 'Curso',
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
        'Se quiser, me envie agora a foto/banner do curso. Se preferir continuar sem imagem, responda "sem foto".',
      pendingAction: {
        type: 'create_course',
        payload,
      },
      actionCard: {
        title: 'Criacao de curso pendente',
        subtitle: payload.name || 'Novo curso',
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
          'Eu preciso do nome do curso para criar. Exemplo: crie um curso com nome "Formacao Comercial".',
      };
    }

    const slug = payload.slug || makeUniqueSlug(title);
    const maxEnrollments =
      payload.limit || context.config.defaultMaxRegistrations || 1000;

    const course = await this.prisma.course.create({
      data: {
        title,
        description:
          payload.description ||
          `Curso criado pelo AI Assist em ${new Date().toLocaleString('pt-BR')}.`,
        bannerUrl: context.mediaUrl || null,
        slug: slugify(slug),
        status: payload.status || 'ACTIVE',
        type: 'ONLINE',
        maxEnrollments,
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        createdBy: context.userId,
      },
    });

    const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/c/${course.slug || course.id}`;

    return {
      message: `Curso criado com sucesso.\n\nNome: ${course.title}\nLimite: ${course.maxEnrollments || 1000} pessoas\nLink de acesso: ${link}`,
      actionCard: {
        title: 'Curso criado',
        subtitle: course.title,
        status: 'completed',
        link,
        fields: [
          { label: 'Status', value: course.status },
          { label: 'Limite', value: String(course.maxEnrollments || 1000) },
          { label: 'Slug', value: course.slug || course.id },
          {
            label: 'Banner',
            value: context.mediaUrl ? 'Com imagem' : 'Sem imagem',
          },
        ],
      },
      action: {
        type: 'create_course',
        courseId: course.id,
        link,
      },
    };
  }
}
