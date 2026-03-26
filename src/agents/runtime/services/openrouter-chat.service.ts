import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ChatHistoryItem } from '../contracts/agent-runtime.types';

@Injectable()
export class OpenRouterChatService {
  private static readonly INVOKE_URL =
    'https://openrouter.ai/api/v1/chat/completions';

  async complete(params: {
    apiKey?: string | null;
    model?: string | null;
    systemPrompt: string;
    message: string;
    history?: ChatHistoryItem[];
  }) {
    const apiKey = params.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Nenhuma API key foi configurada para a AI Assist no backend.',
      );
    }

    const history = (params.history || [])
      .filter((item) => item?.content?.trim())
      .slice(-12)
      .map((item) => ({
        role: item.role,
        content: item.content,
      }));

    const response = await fetch(OpenRouterChatService.INVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model:
          params.model || process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b',
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          { role: 'system', content: params.systemPrompt },
          ...history,
          { role: 'user', content: params.message },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const details =
        errorText?.slice(0, 500) || `${response.status} ${response.statusText}`;

      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException(
          `Falha ao autenticar na OpenRouter. Verifique a API key configurada no backend. Detalhes: ${details}`,
        );
      }

      throw new BadGatewayException(
        `OpenRouter respondeu com erro ${response.status}. Detalhes: ${details}`,
      );
    }

    const data = (await response.json()) as any;
    return data?.choices?.[0]?.message?.content?.trim() || '';
  }
}
