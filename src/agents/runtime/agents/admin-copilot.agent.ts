import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  AgentChatRequest,
  AgentChatResponse,
  CreateEntityActionPayload,
} from '../contracts/agent-runtime.types';
import { AdminAgentPrompt } from '../prompts/admin-agent.prompt';
import { AgentConfigService } from '../services/agent-config.service';
import { AgentContextService } from '../services/agent-context.service';
import { AgentToolRegistryService } from '../services/agent-tool-registry.service';
import { OpenRouterChatService } from '../services/openrouter-chat.service';

@Injectable()
export class AdminCopilotAgent {
  constructor(
    private readonly configService: AgentConfigService,
    private readonly contextService: AgentContextService,
    private readonly toolRegistry: AgentToolRegistryService,
    private readonly openRouterChatService: OpenRouterChatService,
    private readonly adminAgentPrompt: AdminAgentPrompt,
  ) {}

  private extractLimit(message: string) {
    const match = message.match(/limite\s*(?:de|para)?\s*(\d{1,6})/i);
    return match ? Number(match[1]) : null;
  }

  private extractQuotedName(message: string) {
    const quoted = message.match(/["\u201C](.+?)["\u201D]/);
    if (quoted?.[1]) return quoted[1].trim();

    const withName = message.match(/nome\s+(.+?)(?:\s+com\s+limite|\s*$)/i);
    if (withName?.[1]) return withName[1].trim();

    const createThing = message.match(
      /crie\s+(?:um|uma)\s+(?:evento|curso)\s+(.+?)(?:\s+com\s+limite|\s*$)/i,
    );
    return createThing?.[1]?.trim() || null;
  }

  private extractDescription(message: string) {
    const match = message.match(
      /descri(?:cao|\u00E7\u00E3o)\s+(.+?)(?:\s+status\s+|\s+slug\s+|\s+com\s+limite|\s*$)/i,
    );
    return match?.[1]?.trim() || null;
  }

  private extractSlug(message: string) {
    const match = message.match(/slug\s+([a-z0-9-_]+)/i);
    return match?.[1]?.trim() || null;
  }

  private extractStatus(message: string) {
    const match = message.match(
      /status\s+(ativo|active|inativo|inactive|closed|fechado)/i,
    );
    const value = match?.[1]?.toLowerCase();
    if (!value) return null;
    if (value === 'inativo' || value === 'inactive') return 'INACTIVE';
    if (value === 'closed' || value === 'fechado') return 'CLOSED';
    return 'ACTIVE';
  }

  private extractDates(message: string) {
    const startMatch = message.match(
      /(?:inicio|in\u00EDcio|come\u00E7a|comeca)\s+(\d{4}-\d{2}-\d{2})/i,
    );
    const endMatch = message.match(
      /(?:fim|termina|encerra)\s+(\d{4}-\d{2}-\d{2})/i,
    );
    return {
      startDate: startMatch?.[1] || null,
      endDate: endMatch?.[1] || null,
    };
  }

  private wantsNoPhoto(message: string) {
    return /(sem foto|sem imagem|sem banner|nao precisa foto|n\u00E3o precisa foto|pode criar sem foto|segue sem foto)/i.test(
      message,
    );
  }

  private parseAction(message: string): CreateEntityActionPayload | null {
    const normalized = message.trim();
    const lower = normalized.toLowerCase();
    const dates = this.extractDates(normalized);

    if (lower.includes('crie um evento') || lower.includes('criar um evento')) {
      return {
        type: 'create_event',
        name: this.extractQuotedName(normalized),
        limit: this.extractLimit(normalized),
        description: this.extractDescription(normalized),
        slug: this.extractSlug(normalized),
        status: this.extractStatus(normalized),
        ...dates,
      };
    }

    if (lower.includes('crie um curso') || lower.includes('criar um curso')) {
      return {
        type: 'create_course',
        name: this.extractQuotedName(normalized),
        limit: this.extractLimit(normalized),
        description: this.extractDescription(normalized),
        slug: this.extractSlug(normalized),
        status: this.extractStatus(normalized),
        ...dates,
      };
    }

    return null;
  }

  private canPrepareAction(action: CreateEntityActionPayload, config: any) {
    if (action.type === 'create_event') return config.allowEventCreation;
    if (action.type === 'create_course') return config.allowCourseCreation;
    return false;
  }

  async chat(userId: string, body: AgentChatRequest): Promise<AgentChatResponse> {
    const message = body.message?.trim();
    if (!message) {
      throw new InternalServerErrorException('Mensagem nao informada.');
    }

    const config = await this.configService.getConfig(userId);

    const pendingAction = body.pendingAction || null;
    if (pendingAction) {
      const tool = this.toolRegistry.findByAction(pendingAction.type);
      if (!tool) {
        throw new InternalServerErrorException(
          `Nenhuma tool registrada para a acao ${pendingAction.type}.`,
        );
      }

      if (body.mediaUrl || this.wantsNoPhoto(message)) {
        return tool.execute(pendingAction.payload, {
          userId,
          config,
          mediaUrl: body.mediaUrl || null,
        });
      }

      return tool.buildAwaitingMediaResponse(pendingAction.payload, config);
    }

    const action = this.parseAction(message);
    if (action && this.canPrepareAction(action, config)) {
      const tool = this.toolRegistry.findByAction(action.type);
      if (!tool) {
        throw new InternalServerErrorException(
          `Nenhuma tool registrada para a acao ${action.type}.`,
        );
      }

      const payload = {
        ...action,
        limit: action.limit || config.defaultMaxRegistrations || 1000,
      };

      return {
        message:
          action.type === 'create_event'
            ? 'Posso criar esse evento agora. Se quiser, me envie a foto/banner dele. Se preferir seguir sem imagem, responda "sem foto".'
            : 'Posso criar esse curso agora. Se quiser, me envie a foto/banner dele. Se preferir seguir sem imagem, responda "sem foto".',
        pendingAction: {
          type: action.type,
          payload,
        },
        actionCard: tool.buildPendingCard(payload, config),
      };
    }

    const promptContext = await this.contextService.build(userId, config);
    const systemPrompt = this.adminAgentPrompt.build(promptContext);
    const responseMessage = await this.openRouterChatService.complete({
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
      model: config.model || process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b',
      systemPrompt,
      message,
      history: body.history,
    });

    return {
      message: responseMessage,
    };
  }
}
