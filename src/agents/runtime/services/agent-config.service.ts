import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiAssistantConfigData } from '../contracts/agent-runtime.types';

@Injectable()
export class AgentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(userId: string) {
    let config = await this.prisma.aiAssistantConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      config = await this.prisma.aiAssistantConfig.create({
        data: {
          userId,
          isActive: false,
          prompt:
            'Voce e um assistente administrativo. Responda com clareza, execute acoes permitidas e, quando nao puder agir, explique o proximo passo.',
          context: '',
            model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b',
          apiKey: null,
          apiKeyLabel: null,
          allowEventCreation: true,
          allowCourseCreation: true,
          defaultMaxRegistrations: 1000,
        },
      });
    }

    return {
      ...config,
      hasCustomApiKey: Boolean(config.apiKey),
    };
  }

  async updateConfig(userId: string, data: AiAssistantConfigData) {
    const payload = {
      isActive: data.isActive,
      prompt: data.prompt,
      context: data.context,
      model: data.model,
      apiKey: data.apiKey !== undefined ? data.apiKey?.trim() || null : undefined,
      apiKeyLabel:
        data.apiKeyLabel !== undefined
          ? data.apiKeyLabel?.trim() || null
          : undefined,
      allowEventCreation: data.allowEventCreation,
      allowCourseCreation: data.allowCourseCreation,
      defaultMaxRegistrations:
        data.defaultMaxRegistrations !== undefined
          ? Number(data.defaultMaxRegistrations) || 1000
          : undefined,
    };

    const updated = await this.prisma.aiAssistantConfig.upsert({
      where: { userId },
      update: payload,
      create: {
        userId,
        isActive: payload.isActive ?? false,
        prompt: payload.prompt ?? '',
        context: payload.context ?? '',
        model:
          payload.model ?? (process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b'),
        apiKey: payload.apiKey ?? null,
        apiKeyLabel: payload.apiKeyLabel ?? null,
        allowEventCreation: payload.allowEventCreation ?? true,
        allowCourseCreation: payload.allowCourseCreation ?? true,
        defaultMaxRegistrations: payload.defaultMaxRegistrations ?? 1000,
      },
    });

    return {
      ...updated,
      hasCustomApiKey: Boolean(updated.apiKey),
    };
  }
}
