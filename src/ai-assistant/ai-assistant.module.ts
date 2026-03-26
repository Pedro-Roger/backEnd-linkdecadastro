import { Module } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminCopilotAgent } from '../agents/runtime/agents/admin-copilot.agent';
import { AdminAgentPrompt } from '../agents/runtime/prompts/admin-agent.prompt';
import { AgentConfigService } from '../agents/runtime/services/agent-config.service';
import { AgentContextService } from '../agents/runtime/services/agent-context.service';
import { AgentToolRegistryService } from '../agents/runtime/services/agent-tool-registry.service';
import { OpenRouterChatService } from '../agents/runtime/services/openrouter-chat.service';
import { CoursesAgentTool } from '../agents/runtime/tools/courses-agent.tool';
import { EventsAgentTool } from '../agents/runtime/tools/events-agent.tool';

@Module({
  imports: [PrismaModule],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    AgentConfigService,
    AgentContextService,
    AgentToolRegistryService,
    OpenRouterChatService,
    EventsAgentTool,
    CoursesAgentTool,
    AdminCopilotAgent,
    AdminAgentPrompt,
  ],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
