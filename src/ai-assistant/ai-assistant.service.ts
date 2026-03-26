import { Injectable } from '@nestjs/common';
import { AdminCopilotAgent } from '../agents/runtime/agents/admin-copilot.agent';
import {
  AgentChatRequest,
  AiAssistantConfigData,
} from '../agents/runtime/contracts/agent-runtime.types';
import { AgentConfigService } from '../agents/runtime/services/agent-config.service';

@Injectable()
export class AiAssistantService {
  constructor(
    private readonly configService: AgentConfigService,
    private readonly adminCopilotAgent: AdminCopilotAgent,
  ) {}

  async getConfig(userId: string) {
    return this.configService.getConfig(userId);
  }

  async updateConfig(userId: string, data: AiAssistantConfigData) {
    return this.configService.updateConfig(userId, data);
  }

  async chat(userId: string, body: AgentChatRequest) {
    return this.adminCopilotAgent.chat(userId, body);
  }
}
