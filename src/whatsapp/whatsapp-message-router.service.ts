import { Injectable } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { AiChatService } from './ai-chat.service';
import {
  WHATSAPP_BOT_DEFAULTS,
  WHATSAPP_BOT_MESSAGES,
  containsKeyword,
  createBotLog,
  formatDate,
  formatPhoneNumber,
  formatTime,
  parseCommand,
} from './whatsapp-bot.config';
import { WhatsAppBotContextService } from './whatsapp-bot-context.service';

interface IncomingMessageParams {
  sessionId: string;
  remoteJid: string;
  providerMessageId: string;
  text: string;
  contactNumber: string;
  contactName?: string;
}

interface MessageRuntime {
  markAsRead: () => Promise<void>;
  setTyping: (active: boolean) => Promise<void>;
  sendText: (text: string, senderName?: string) => Promise<void>;
}

@Injectable()
export class WhatsAppMessageRouterService {
  private readonly userCooldowns = new Map<string, number>();
  private readonly responseCache = new Map<
    string,
    { reply: string; expiresAt: number }
  >();

  constructor(
    private readonly aiChatService: AiChatService,
    private readonly agentsService: AgentsService,
    private readonly contextService: WhatsAppBotContextService,
  ) {}

  private log(
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS',
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    const entry = createBotLog(level, message, metadata);
    const payload = JSON.stringify(entry);

    if (level === 'ERROR') {
      console.error(payload);
      return;
    }

    if (level === 'WARN') {
      console.warn(payload);
      return;
    }

    console.log(payload);
  }

  private getUserKey(sessionId: string, remoteJid: string) {
    return `${sessionId}:${remoteJid}`;
  }

  private getCacheKey(sessionId: string, remoteJid: string, text: string) {
    return `${sessionId}:${remoteJid}:${text.trim().toLowerCase()}`;
  }

  private isCoolingDown(userKey: string) {
    const until = this.userCooldowns.get(userKey) || 0;
    return until > Date.now();
  }

  private markCooldown(userKey: string) {
    this.userCooldowns.set(
      userKey,
      Date.now() + WHATSAPP_BOT_DEFAULTS.perUserCooldownMs,
    );
  }

  private getCachedReply(cacheKey: string) {
    const item = this.responseCache.get(cacheKey);
    if (!item) return null;

    if (item.expiresAt <= Date.now()) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    return item.reply;
  }

  private setCachedReply(cacheKey: string, reply: string) {
    this.responseCache.set(cacheKey, {
      reply,
      expiresAt: Date.now() + WHATSAPP_BOT_DEFAULTS.cacheTtlMs,
    });
  }

  private buildKeywordReply(text: string) {
    if (
      containsKeyword(
        text,
        ['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite'],
        { exact: true },
      )
    ) {
      return 'Oi. Como posso te ajudar hoje?';
    }

    if (
      containsKeyword(text, ['obrigado', 'obrigada', 'valeu'], {
        exact: true,
      })
    ) {
      return 'Por nada. Se precisar de mais alguma coisa, sigo por aqui.';
    }

    return null;
  }

  private buildLocalFallback(text: string) {
    const normalized = text.toLowerCase();

    if (/(humano|atendente|suporte|pessoa)/.test(normalized)) {
      return 'Claro. Posso seguir com voce por aqui e, se precisar, encaminho para atendimento humano.';
    }

    if (/(preco|preço|valor|plano|mensalidade)/.test(normalized)) {
      return 'Posso te explicar os planos e valores por aqui. Se quiser, tambem posso direcionar voce para o atendimento comercial.';
    }

    if (/(evento|inscri|cadastro|link)/.test(normalized)) {
      return 'Posso te ajudar com eventos, inscricoes e links de cadastro. Me diga qual evento ou objetivo voce procura.';
    }

    if (/(curso|aula|treinamento|capacit)/.test(normalized)) {
      return 'Posso te ajudar com cursos e capacitacoes. Se quiser, me diga qual curso voce procura ou qual e a sua duvida.';
    }

    if (/(obrigado|obrigada|valeu)/.test(normalized)) {
      return 'Por nada. Se precisar de mais alguma coisa, sigo por aqui.';
    }

    return 'Recebi sua mensagem. Posso te ajudar com cadastro, eventos, cursos, planos ou atendimento.';
  }

  private async handleCommand(
    commandText: string,
    params: IncomingMessageParams,
    runtime: MessageRuntime,
  ) {
    const command = parseCommand(commandText);
    if (!command) return false;

    switch (command.name) {
      case 'help':
        await runtime.sendText(WHATSAPP_BOT_MESSAGES.help, 'Bot');
        return true;
      case 'hora': {
        const now = new Date();
        await runtime.sendText(
          `Agora sao ${formatTime(now)} de ${formatDate(now)}.`,
          'Bot',
        );
        return true;
      }
      case 'status': {
        const resolved = await this.agentsService.resolveConversationAgent(
          params.sessionId,
          params.remoteJid,
        );
        const history = await this.contextService.getRecentConversationHistory(
          params.sessionId,
          params.remoteJid,
          5,
        );
        const agentLabel = resolved.agent?.name || 'nenhum agente vinculado';
        const mode = resolved.mode || 'HUMAN';
        await runtime.sendText(
          [
            `Modo atual: ${mode}.`,
            `Agente: ${agentLabel}.`,
            `Telefone: ${formatPhoneNumber(params.contactNumber)}.`,
            `Mensagens recentes no contexto: ${history.messages.length}.`,
          ].join('\n'),
          'Bot',
        );
        return true;
      }
      case 'reset': {
        const reset = await this.contextService.resetConversationContext(
          params.sessionId,
          params.remoteJid,
        );
        await runtime.sendText(
          reset
            ? 'Contexto desta conversa foi limpo. A proxima resposta vai considerar um contexto novo.'
            : 'Nao encontrei contexto salvo para limpar nesta conversa.',
          'Bot',
        );
        return true;
      }
      default:
        await runtime.sendText(
          'Comando nao reconhecido. Use !help para ver os comandos disponiveis.',
          'Bot',
        );
        return true;
    }
  }

  async handleIncomingMessage(
    params: IncomingMessageParams,
    runtime: MessageRuntime,
  ) {
    const text = params.text.trim();
    const userKey = this.getUserKey(params.sessionId, params.remoteJid);
    const cacheKey = this.getCacheKey(params.sessionId, params.remoteJid, text);

    await runtime.markAsRead();

    if (text.length < WHATSAPP_BOT_DEFAULTS.minMessageLength) {
      await this.aiChatService.registrarDiagnostico({
        sessionId: params.sessionId,
        remoteJid: params.remoteJid,
        providerMessageId: params.providerMessageId,
        status: 'SKIPPED',
        reason: 'message_too_short',
        mode: 'AUTONOMOUS',
        agentId: null,
        agentName: null,
        userMessage: text,
      });
      this.log('INFO', WHATSAPP_BOT_MESSAGES.shortMessageIgnored, {
        sessionId: params.sessionId,
        remoteJid: params.remoteJid,
      });
      return;
    }

    if (await this.handleCommand(text, params, runtime)) {
      this.markCooldown(userKey);
      return;
    }

    const keywordReply = this.buildKeywordReply(text);
    if (keywordReply) {
      await runtime.sendText(keywordReply, 'Bot');
      this.markCooldown(userKey);
      return;
    }

    if (!WHATSAPP_BOT_DEFAULTS.aiEnabled) {
      this.log('WARN', 'IA do WhatsApp desativada por configuracao.', {
        sessionId: params.sessionId,
        remoteJid: params.remoteJid,
      });
      return;
    }

    if (this.isCoolingDown(userKey)) {
      await this.aiChatService.registrarDiagnostico({
        sessionId: params.sessionId,
        remoteJid: params.remoteJid,
        providerMessageId: params.providerMessageId,
        status: 'SKIPPED',
        reason: 'contact_in_cooldown_window',
        mode: 'AUTONOMOUS',
        agentId: null,
        agentName: null,
        userMessage: text,
      });
      return;
    }

    const cachedReply = this.getCachedReply(cacheKey);
    if (cachedReply) {
      await runtime.sendText(cachedReply, 'IA');
      this.markCooldown(userKey);
      this.log('SUCCESS', 'Resposta enviada a partir do cache.', {
        sessionId: params.sessionId,
        remoteJid: params.remoteJid,
      });
      return;
    }

    await runtime.setTyping(true);
    const responsePromise = this.aiChatService.consultarAssistente({
      perguntaUsuario: text,
      telefoneDoUsuario: params.contactNumber,
      sessionId: params.sessionId,
      remoteJid: params.remoteJid,
      providerMessageId: params.providerMessageId,
    });

    let aiResult: Awaited<typeof responsePromise> | null = null;
    let sentProcessingMessage = false;

    try {
      const timedResponse = await Promise.race([
        responsePromise.then((result) => ({ type: 'result' as const, result })),
        new Promise<{ type: 'timeout' }>((resolve) =>
          setTimeout(
            () => resolve({ type: 'timeout' }),
            WHATSAPP_BOT_DEFAULTS.aiTimeoutMs,
          ),
        ),
      ]);

      if (timedResponse.type === 'timeout') {
        sentProcessingMessage = true;
        await runtime.sendText(WHATSAPP_BOT_DEFAULTS.processingMessage, 'Bot');
        aiResult = await responsePromise;
      } else {
        aiResult = timedResponse.result;
      }

      let reply = aiResult?.reply?.trim() || '';

      if (
        !reply &&
        (aiResult?.reason === 'provider_request_failed' ||
          aiResult?.reason === 'provider_rate_limited')
      ) {
        reply =
          cachedReply ||
          this.buildLocalFallback(text) ||
          WHATSAPP_BOT_DEFAULTS.fallbackMessage;
      }

      if (!reply) {
        return;
      }

      if (
        !sentProcessingMessage ||
        reply !== WHATSAPP_BOT_DEFAULTS.processingMessage
      ) {
        await runtime.sendText(reply, 'IA');
      }

      this.setCachedReply(cacheKey, reply);
      this.markCooldown(userKey);
      this.log('SUCCESS', 'Resposta automatica enviada.', {
        sessionId: params.sessionId,
        remoteJid: params.remoteJid,
        reason: aiResult?.reason || 'manual_fallback',
      });
    } catch (error: any) {
      this.log('ERROR', 'Falha ao processar mensagem automatica.', {
        sessionId: params.sessionId,
        remoteJid: params.remoteJid,
        error: error?.message || 'unknown_error',
      });

      const fallbackReply =
        cachedReply ||
        this.buildLocalFallback(text) ||
        WHATSAPP_BOT_DEFAULTS.fallbackMessage;
      await runtime.sendText(fallbackReply, 'Bot');
      this.markCooldown(userKey);
    } finally {
      await runtime.setTyping(false);
    }
  }
}
