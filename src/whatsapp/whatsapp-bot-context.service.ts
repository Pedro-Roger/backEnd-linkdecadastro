import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ROUTES_COLLECTION = 'service_agent_routes';
const AGENT_RUNS_COLLECTION = 'service_agent_runs';

@Injectable()
export class WhatsAppBotContextService {
  constructor(private readonly prisma: PrismaService) {}

  private async runCommand<T = any>(command: Record<string, unknown>): Promise<T> {
    return (this.prisma as any).$runCommandRaw(command);
  }

  async getRecentConversationHistory(
    sessionId: string,
    remoteJid: string,
    limit = 10,
  ) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        channel_id: sessionId,
        provider_uid: remoteJid,
      },
      include: {
        messages: {
          orderBy: { sent_at: 'desc' },
          take: limit,
        },
      },
    });

    return {
      conversationId: conversation?.id,
      messages: (conversation?.messages || []).slice().reverse(),
    };
  }

  async resetConversationContext(sessionId: string, remoteJid: string) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        channel_id: sessionId,
        provider_uid: remoteJid,
      },
      select: { id: true },
    });

    if (!conversation?.id) {
      return false;
    }

    await Promise.all([
      this.runCommand({
        update: ROUTES_COLLECTION,
        updates: [
          {
            q: { conversation_id: conversation.id },
            u: {
              $set: {
                memory_summary: '',
                last_intent: '',
                updated_at: new Date(),
              },
            },
            upsert: false,
            multi: false,
          },
        ],
      }),
      this.runCommand({
        delete: AGENT_RUNS_COLLECTION,
        deletes: [
          {
            q: {
              conversation_id: conversation.id,
            },
            limit: 0,
          },
        ],
      }),
    ]);

    return true;
  }
}
