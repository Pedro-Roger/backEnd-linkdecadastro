import { Injectable } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiChatService {
  private static readonly INVOKE_URL =
    'https://openrouter.ai/api/v1/chat/completions';

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentsService: AgentsService,
  ) {}

  private buildPhoneVariants(phone: string) {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('55')) cleanPhone = cleanPhone.substring(2);

    const variants = new Set<string>([cleanPhone]);

    if (cleanPhone.length === 10) {
      variants.add(cleanPhone.substring(0, 2) + '9' + cleanPhone.substring(2));
    } else if (cleanPhone.length === 11 && cleanPhone[2] === '9') {
      variants.add(cleanPhone.substring(0, 2) + cleanPhone.substring(3));
    }

    variants.add(`55${cleanPhone}`);

    return Array.from(variants).filter(Boolean);
  }

  async consultarAssistente(params: {
    perguntaUsuario: string;
    telefoneDoUsuario: string;
    sessionId: string;
    remoteJid: string;
  }) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.warn('OPENROUTER_API_KEY nao esta configurada no .env.');
      return null;
    }

    const { perguntaUsuario, telefoneDoUsuario, sessionId, remoteJid } = params;

    const resolvedAgent = await this.agentsService.resolveConversationAgent(
      sessionId,
      remoteJid,
    );

    if (resolvedAgent.mode === 'HUMAN' || resolvedAgent.mode === 'COPILOT') {
      return null;
    }

    const channelMember = await this.prisma.chatChannelMember.findFirst({
      where: { channel_id: sessionId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    });

    if (!channelMember) {
      return null;
    }

    const config = await this.prisma.aiAssistantConfig.findUnique({
      where: { userId: channelMember.user_id },
    });

    if (!config?.isActive) {
      return null;
    }

    try {
      const phoneVariants = this.buildPhoneVariants(telefoneDoUsuario);
      const [user, registrations, activeEvents, conversation] = await Promise.all([
        this.prisma.user.findFirst({
          where: { phone: { in: phoneVariants } },
        }),
        this.prisma.registration.findMany({
          where: { phone: { in: phoneVariants } },
          include: { event: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.event.findMany({
          where: {
            createdBy: channelMember.user_id,
            status: 'ACTIVE',
          },
          select: { title: true, slug: true, linkId: true, description: true },
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.chatConversation.findFirst({
          where: {
            channel_id: sessionId,
            provider_uid: remoteJid,
          },
          include: {
            messages: {
              orderBy: { sent_at: 'desc' },
              take: 12,
            },
          },
        }),
      ]);

      const availableEvents = activeEvents
        .map((event) => {
          const link = event.slug
            ? `https://linkdecadastro.com.br/e/${event.slug}`
            : `https://linkdecadastro.com.br/register/${event.linkId}`;

          return `- ${event.title}: ${link}`;
        })
        .join('\n');

      const recentHistory = (conversation?.messages || [])
        .slice()
        .reverse()
        .map((message) => {
          const role = message.direction === 'OUTGOING' ? 'Atendente/IA' : 'Cliente';
          return `${role}: ${message.content || ''}`.trim();
        })
        .join('\n');

      const registrationsSummary = registrations
        .map((registration) => `- ${registration.event.title}`)
        .join('\n');

      const contactName =
        user?.name?.trim() ||
        registrations.find((registration) => registration.name?.trim())?.name?.trim() ||
        conversation?.contact_name?.trim() ||
        'Usuario Novo';

      const systemPrompt = `
Voce e uma atendente de WhatsApp da plataforma Link de Cadastro.
Seu objetivo e responder de forma natural, humana, clara e util, sempre em portugues do Brasil.

REGRAS:
1. Soe como uma atendente real, nao como um robo.
2. Seja objetiva, acolhedora e contextual.
3. Nunca invente informacoes.
4. Quando nao souber algo, diga com naturalidade que vai encaminhar para atendimento humano.
5. Quando fizer sentido, use o primeiro nome do cliente.
6. Se o cliente pedir inscricao ou eventos disponiveis, use apenas a lista de eventos abaixo.
7. Responda considerando o historico recente da conversa para manter contexto.
8. Se a pergunta pedir atendimento humano, nao insista em automatizar.
9. Se houver agente vinculado, siga primeiro as instrucoes dele.

AGENTE VINCULADO:
- Nome: ${resolvedAgent.agent?.name || 'Atendente principal'}
- Modulo: ${resolvedAgent.agent?.module || 'atendimento'}
- Ferramentas habilitadas: ${resolvedAgent.agent?.tools?.join(', ') || 'conversation.history, contact.lookup, human.handoff'}
- Modo da conversa: ${resolvedAgent.mode}

PERSONA PERSONALIZADA:
${resolvedAgent.agent?.instructions || config.prompt || 'Atenda com educacao, naturalidade e clareza.'}

BASE DE CONHECIMENTO:
${resolvedAgent.agent?.knowledge_base || config.context || 'Sem contexto adicional cadastrado.'}

RESUMO OPERACIONAL DA CONVERSA:
${resolvedAgent.route?.memory_summary || '- Sem resumo salvo'}

INTENCAO MAIS RECENTE:
${resolvedAgent.route?.last_intent || '- Nao identificada'}

DADOS DO CONTATO:
- Nome: ${contactName}
- Telefone: ${telefoneDoUsuario}
- Ja possui cadastro na plataforma: ${user || registrations.length > 0 ? 'Sim' : 'Nao'}
- Eventos em que ja se inscreveu:
${registrationsSummary || '- Nenhum encontrado'}

EVENTOS ATIVOS DISPONIVEIS:
${availableEvents || '- Nenhum evento ativo no momento'}

HISTORICO RECENTE DA CONVERSA:
${recentHistory || '- Sem historico anterior'}
      `.trim();

      const payload = {
        model:
          resolvedAgent.agent?.model ||
          process.env.OPENROUTER_MODEL ||
          'openai/gpt-4.1-mini',
        max_tokens: 500,
        temperature: 0.45,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: perguntaUsuario },
        ],
      };

      const response = await fetch(AiChatService.INVOKE_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Erro na API OpenRouter: ${response.status} ${response.statusText}`,
        );
      }

      const responseBody = (await response.json()) as any;
      const content = responseBody?.choices?.[0]?.message?.content?.trim();

      return content || null;
    } catch (error) {
      console.error('Erro na comunicacao com OpenRouter AI:', error);
      return null;
    }
  }
}
