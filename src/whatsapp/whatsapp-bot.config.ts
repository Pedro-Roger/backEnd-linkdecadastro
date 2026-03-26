export type BotLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export interface ParsedCommand {
  raw: string;
  name: string;
  args: string[];
}

export const WHATSAPP_BOT_DEFAULTS = {
  aiEnabled: process.env.WHATSAPP_ENABLE_AI !== 'false',
  aiTimeoutMs: Number(process.env.WHATSAPP_AI_TIMEOUT_MS || 12000),
  maxHistory: Number(process.env.WHATSAPP_AI_MAX_HISTORY || 10),
  minMessageLength: Number(process.env.WHATSAPP_MIN_MESSAGE_LENGTH || 2),
  perUserCooldownMs: Number(process.env.WHATSAPP_USER_COOLDOWN_MS || 3000),
  cacheTtlMs: Number(process.env.WHATSAPP_RESPONSE_CACHE_TTL_MS || 5 * 60 * 1000),
  processingMessage: process.env.WHATSAPP_PROCESSING_MESSAGE || '',
  fallbackMessage:
    process.env.WHATSAPP_FALLBACK_MESSAGE ||
    'Tive uma instabilidade aqui e nao quero te responder de qualquer jeito. Me chama de novo daqui a pouco?',
};

export const WHATSAPP_BOT_MESSAGES = {
  help: [
    'Comandos disponiveis:',
    '!help - mostra os comandos do bot',
    '!status - mostra o modo do atendimento nesta conversa',
    '!hora - informa data e hora do servidor',
    '!reset - limpa o contexto salvo desta conversa',
  ].join('\n'),
  shortMessageIgnored:
    'Mensagem muito curta para gerar resposta automatica.',
};

export function formatPhoneNumber(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(
      4,
      9,
    )}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(
      4,
      8,
    )}-${digits.slice(8)}`;
  }
  return digits;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: process.env.TZ || 'America/Sao_Paulo',
  }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeStyle: 'medium',
    timeZone: process.env.TZ || 'America/Sao_Paulo',
  }).format(date);
}

export function parseCommand(text: string): ParsedCommand | null {
  const normalized = String(text || '').trim();
  if (!normalized.startsWith('!')) {
    return null;
  }

  const [rawName, ...args] = normalized.slice(1).split(/\s+/);
  const name = rawName?.trim().toLowerCase();

  if (!name) {
    return null;
  }

  return {
    raw: normalized,
    name,
    args,
  };
}

export function isCommand(text: string) {
  return Boolean(parseCommand(text));
}

export function containsKeyword(
  text: string,
  keywords: string[],
  options: { exact?: boolean } = {},
) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;

  return keywords.some((keyword) => {
    const term = keyword.toLowerCase();
    if (options.exact) {
      return normalized === term;
    }
    return normalized.includes(term);
  });
}

export function isGroup(jid?: string | null) {
  return String(jid || '').includes('@g.us');
}

export function isPerson(jid?: string | null) {
  const normalized = String(jid || '');
  return normalized.includes('@s.whatsapp.net') || normalized.includes('@lid');
}

export function fromUser(message: { key?: { fromMe?: boolean } } | undefined) {
  return !message?.key?.fromMe;
}

export function createBotLog(
  level: BotLogLevel,
  message: string,
  metadata?: Record<string, unknown>,
) {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    level,
    message,
    ...(metadata ? { metadata } : {}),
  };
}
