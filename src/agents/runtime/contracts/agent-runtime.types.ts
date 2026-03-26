export interface AiAssistantConfigData {
  isActive?: boolean;
  prompt?: string;
  context?: string;
  model?: string;
  apiKey?: string;
  apiKeyLabel?: string;
  allowEventCreation?: boolean;
  allowCourseCreation?: boolean;
  defaultMaxRegistrations?: number;
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface CreateEntityActionPayload {
  type: 'create_event' | 'create_course';
  name: string | null;
  limit: number | null;
  description?: string | null;
  slug?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface PendingAction {
  type: 'create_event' | 'create_course';
  payload: CreateEntityActionPayload;
}

export interface AgentChatRequest {
  message: string;
  mediaUrl?: string | null;
  history?: ChatHistoryItem[];
  pendingAction?: PendingAction | null;
}

export interface ActionCardField {
  label: string;
  value: string;
}

export interface ActionCard {
  title: string;
  subtitle: string;
  fields: ActionCardField[];
  link?: string;
  status: 'pending' | 'completed';
}

export interface AgentChatResponse {
  message: string;
  pendingAction?: PendingAction;
  actionCard?: ActionCard;
  action?: Record<string, unknown>;
}

export interface AgentToolExecutionContext {
  userId: string;
  config: any;
  mediaUrl?: string | null;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  supports(actionType: PendingAction['type']): boolean;
  buildPendingCard(payload: CreateEntityActionPayload, config: any): ActionCard;
  buildAwaitingMediaResponse(
    payload: CreateEntityActionPayload,
    config: any,
  ): AgentChatResponse;
  execute(
    payload: CreateEntityActionPayload,
    context: AgentToolExecutionContext,
  ): Promise<AgentChatResponse>;
}

export interface AgentPromptContext {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  config: any;
  courses: Array<{
    title: string;
    status: string;
    enrollmentsCount: number;
  }>;
  events: Array<{
    title: string;
    status: string;
    registrationsCount: number;
  }>;
}
