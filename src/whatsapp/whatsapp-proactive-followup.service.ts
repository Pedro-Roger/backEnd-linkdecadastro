import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiChatService } from './ai-chat.service';
import { AgentsService } from '../agents/agents.service';
import { WhatsAppService } from './whatsapp.service';

const AGENT_RUNS_COLLECTION = 'service_agent_runs';

interface CourseLaunchPayload {
  id: string;
  title: string;
  description?: string | null;
  slug?: string | null;
  status?: string | null;
}

interface PendingInterestMatch {
  requestMessage: string;
  requestAt: Date;
}

@Injectable()
export class WhatsAppProactiveFollowupService {
  private readonly enabled =
    process.env.WHATSAPP_ENABLE_PROACTIVE_FOLLOWUPS !== 'false';
  private readonly lookbackHours = Number(
    process.env.WHATSAPP_PROACTIVE_LOOKBACK_HOURS || 24 * 30,
  );
  private readonly maxMessagesPerConversation = Number(
    process.env.WHATSAPP_PROACTIVE_MAX_MESSAGES || 12,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService,
    private readonly agentsService: AgentsService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  private async runCommand<T = any>(command: Record<string, unknown>): Promise<T> {
    return (this.prisma as any).$runCommandRaw(command);
  }

  private buildCourseUrl(course: CourseLaunchPayload) {
    const frontendUrl =
      process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
    const siteUrl = frontendUrl.replace(/\/$/, '');
    return course.slug
      ? `${siteUrl}/c/${course.slug}`
      : `${siteUrl}/course/${course.id}`;
  }

  private normalizeText(value: string | null | undefined) {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private findPendingInterest(
    messages: Array<{ direction: string; content: string | null; sent_at: Date }>,
  ) {
    const sorted = messages
      .slice()
      .sort(
        (a, b) =>
          new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
      );

    let latestMatch: PendingInterestMatch | null = null;

    for (const message of sorted) {
      if (message.direction !== 'INCOMING') continue;

      const normalized = this.normalizeText(message.content);
      if (!normalized) continue;

      const askedForCourse = /(curso|aula|treinamento|capacit)/.test(
        normalized,
      );
      const askedToBeNotified =
        /(me avise|me avisa|me informe|me notifica|me chama|quando (?:o )?(?:curso )?(?:lancar|sair|abrir)|pode avisar|quero ser avisad|avisar quando)/.test(
          normalized,
        );

      if (askedForCourse && askedToBeNotified) {
        latestMatch = {
          requestMessage: message.content || '',
          requestAt: new Date(message.sent_at),
        };
      }
    }

    return latestMatch;
  }

  private buildLaunchMessage(params: {
    contactName?: string | null;
    course: CourseLaunchPayload;
  }) {
    const { contactName, course } = params;
    const firstName = (contactName || '').trim().split(/\s+/)[0];
    const greeting = firstName ? `Oi, ${firstName}.` : 'Oi.';
    const description = (course.description || '').trim().slice(0, 180);
    const suffix = description ? ` ${description}` : '';
    const link = this.buildCourseUrl(course);

    return [
      greeting,
      `Lembrei de voce porque voce tinha pedido para ser avisado quando surgisse um novo curso. O curso "${course.title}" acabou de ser lancado.${suffix}`,
      `Se quiser dar uma olhada nos detalhes ou se inscrever, e so acessar: ${link}`,
      'Se preferir, posso continuar te ajudando por aqui.',
    ].join(' ');
  }

  private async alreadyNotified(conversationId: string, courseId: string) {
    const response = await this.runCommand<any>({
      find: AGENT_RUNS_COLLECTION,
      filter: {
        conversation_id: conversationId,
        reason: 'proactive_course_launch_followup',
        user_message: `course_launch:${courseId}`,
      },
      limit: 1,
    });

    return Boolean(response?.cursor?.firstBatch?.[0]);
  }

  async notifyInterestedContactsAboutCourse(course: CourseLaunchPayload) {
    if (!this.enabled) {
      return { notified: 0, skipped: 0, reason: 'disabled' };
    }

    if ((course.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      return { notified: 0, skipped: 0, reason: 'course_not_active' };
    }

    const cutoff = new Date(Date.now() - this.lookbackHours * 60 * 60 * 1000);

    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        deleted_at: null,
        is_archived: false,
        updated_at: { gte: cutoff },
        channel: {
          provider: 'baileys',
          deleted_at: null,
        },
      },
      include: {
        messages: {
          orderBy: { sent_at: 'desc' },
          take: this.maxMessagesPerConversation,
        },
      },
      orderBy: { updated_at: 'desc' },
      take: 200,
    });

    let notified = 0;
    let skipped = 0;

    for (const conversation of conversations) {
      try {
        if (
          !conversation.provider_uid ||
          conversation.provider_uid.includes('@g.us')
        ) {
          skipped += 1;
          continue;
        }

        const pendingInterest = this.findPendingInterest(
          conversation.messages as any,
        );
        if (!pendingInterest) {
          skipped += 1;
          continue;
        }

        if (await this.alreadyNotified(conversation.id, course.id)) {
          skipped += 1;
          continue;
        }

        const resolvedAgent = await this.agentsService.resolveConversationAgent(
          conversation.channel_id,
          conversation.provider_uid,
        );

        if (resolvedAgent.mode !== 'AUTONOMOUS') {
          await this.aiChatService.registrarDiagnostico({
            sessionId: conversation.channel_id,
            remoteJid: conversation.provider_uid,
            conversationId: conversation.id,
            status: 'SKIPPED',
            reason: 'proactive_followup_requires_autonomous_mode',
            mode: resolvedAgent.mode,
            agentId: resolvedAgent.agent?.id || null,
            agentName: resolvedAgent.agent?.name || null,
            userMessage: `course_launch:${course.id}`,
            lastIntent: 'course_interest',
            memorySummary:
              'Contato pediu aviso de curso, mas a conversa nao estava em modo AUTONOMOUS no momento do follow-up.',
            actions: [
              {
                type: 'course.launch.followup',
                status: 'blocked',
                detail:
                  'Follow-up automatico bloqueado porque a conversa nao esta em modo AUTONOMOUS.',
              },
            ],
          });
          skipped += 1;
          continue;
        }

        const reply = this.buildLaunchMessage({
          contactName: conversation.contact_name,
          course,
        });

        await this.whatsappService.enviarMensagemDireta(
          conversation.channel_id,
          conversation.provider_uid,
          reply,
        );

        await this.aiChatService.registrarDiagnostico({
          sessionId: conversation.channel_id,
          remoteJid: conversation.provider_uid,
          conversationId: conversation.id,
          status: 'RESPONDED',
          reason: 'proactive_course_launch_followup',
          mode: resolvedAgent.mode,
          agentId: resolvedAgent.agent?.id || null,
          agentName: resolvedAgent.agent?.name || null,
          userMessage: `course_launch:${course.id}`,
          reply,
          lastIntent: 'course_interest',
          memorySummary: `Contato pediu para ser avisado sobre novos cursos e foi recontatado quando o curso "${course.title}" foi criado.`,
          actions: [
            {
              type: 'course.launch.followup',
              status: 'completed',
              detail: `Follow-up automatico enviado por causa do curso "${course.title}".`,
            },
          ],
        });

        notified += 1;
      } catch (error) {
        skipped += 1;
        console.error(
          '[WhatsApp] Falha ao executar follow-up proativo de curso:',
          error,
        );
      }
    }

    return { notified, skipped, reason: 'processed' };
  }
}
