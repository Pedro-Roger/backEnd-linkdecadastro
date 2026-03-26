import { Injectable } from '@nestjs/common';
import {
  AgentToolDefinition,
  PendingAction,
} from '../contracts/agent-runtime.types';
import { CoursesAgentTool } from '../tools/courses-agent.tool';
import { EventsAgentTool } from '../tools/events-agent.tool';

@Injectable()
export class AgentToolRegistryService {
  private readonly tools: AgentToolDefinition[];

  constructor(
    private readonly eventsAgentTool: EventsAgentTool,
    private readonly coursesAgentTool: CoursesAgentTool,
  ) {
    this.tools = [this.eventsAgentTool, this.coursesAgentTool];
  }

  findByAction(type: PendingAction['type']) {
    return this.tools.find((tool) => tool.supports(type)) || null;
  }

  list() {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}
