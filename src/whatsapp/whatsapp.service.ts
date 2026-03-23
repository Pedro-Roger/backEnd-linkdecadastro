import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { AiChatService } from './ai-chat.service';
import { AgentsService } from '../agents/agents.service';

// We'll import types only to avoid runtime require() calls
import type { WASocket } from '@whiskeysockets/baileys';

export enum WhatsAppStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  QR_CODE = 'QR_CODE',
  AUTHENTICATED = 'AUTHENTICATED',
  READY = 'READY',
  AUTH_FAILURE = 'AUTH_FAILURE',
}

interface QRCodeData {
  qr: string;
  base64: string;
}

interface WhatsAppInstance {
  socket: WASocket | null;
  status: WhatsAppStatus;
  qrCodeData: QRCodeData | null;
  retryCount: number;
  phoneNumber?: string;
  chats: Map<string, any>;
  contacts: Map<string, any>;
}

interface StoredMessageInput {
  id: string;
  text?: string;
  sender: 'me' | 'them';
  profilePicUrl?: string;
  senderName?: string;
  contactName?: string;
  contactNumber?: string;
  isGroup?: boolean;
  mediaUrl?: string;
  mediaType?: string;
  mimetype?: string;
  fileSize?: number;
}

export interface ContactInfoResult {
  userId?: string;
  name: string | null;
  role: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  participantType?: string | null;
  source?: 'user' | 'registration' | 'unknown';
  courses: string[];
  events: string[];
}

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private instances: Map<string, WhatsAppInstance> = new Map();
  private messages: Map<string, any[]> = new Map(); // sessionId:jid -> messages[]
  private authWriteLocks: Map<string, Promise<void>> = new Map();
  private RETRY_INTERVAL = 5000;
  private MAX_RETRIES = 5;

  private baileysModule: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService,
    private readonly agentsService: AgentsService,
  ) { }

  private async getBaileys() {
    if (!this.baileysModule) {
      this.baileysModule = await import('@whiskeysockets/baileys');
    }
    return this.baileysModule;
  }

  async onModuleInit() {
    console.log('🚀 [WhatsApp Baileys] Serviço pronto para inicialização');
  }

  async onModuleDestroy() {
    for (const [, instance] of this.instances) {
      if (instance.socket) {
        instance.socket.end(undefined);
      }
    }
  }

  private getInstance(sessionId: string): WhatsAppInstance {
    if (!this.instances.has(sessionId)) {
      this.instances.set(sessionId, {
        socket: null,
        status: WhatsAppStatus.DISCONNECTED,
        qrCodeData: null,
        retryCount: 0,
        chats: new Map(),
        contacts: new Map(),
      });
    }
    return this.instances.get(sessionId)!;
  }

  private normalizeGroupId(groupId: string): string {
    const trimmed = groupId?.trim().replace(/\s+/g, '');
    if (!trimmed) {
      throw new Error('ID do grupo não informado');
    }
    if (trimmed.includes('@g.us')) return trimmed;
    return `${trimmed}@g.us`;
  }

  private normalizeContactJid(value: string | undefined | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes('@')) return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;
    return `${digits}@s.whatsapp.net`;
  }

  private unwrapMessageContent(message: any): any {
    let current = message;

    while (current) {
      if (current.ephemeralMessage?.message) {
        current = current.ephemeralMessage.message;
        continue;
      }

      if (current.viewOnceMessage?.message) {
        current = current.viewOnceMessage.message;
        continue;
      }

      if (current.viewOnceMessageV2?.message) {
        current = current.viewOnceMessageV2.message;
        continue;
      }

      if (current.viewOnceMessageV2Extension?.message) {
        current = current.viewOnceMessageV2Extension.message;
        continue;
      }

      if (current.documentWithCaptionMessage?.message) {
        current = current.documentWithCaptionMessage.message;
        continue;
      }

      if (current.editedMessage?.message) {
        current = current.editedMessage.message;
        continue;
      }

      break;
    }

    return current;
  }

  private getMessageText(message: any): string | undefined {
    const normalizedMessage = this.unwrapMessageContent(message);

    return (
      normalizedMessage?.conversation ||
      normalizedMessage?.extendedTextMessage?.text ||
      normalizedMessage?.imageMessage?.caption ||
      normalizedMessage?.videoMessage?.caption ||
      normalizedMessage?.documentMessage?.caption ||
      normalizedMessage?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
      normalizedMessage?.buttonsResponseMessage?.selectedDisplayText ||
      normalizedMessage?.listResponseMessage?.title ||
      normalizedMessage?.templateButtonReplyMessage?.selectedDisplayText
    );
  }

  private getMediaPayload(message: any) {
    const normalizedMessage = this.unwrapMessageContent(message);

    if (normalizedMessage?.imageMessage) {
      return {
        mediaType: 'image',
        mimetype: normalizedMessage.imageMessage.mimetype,
        fileSize: Number(normalizedMessage.imageMessage.fileLength || 0) || undefined,
      };
    }

    if (normalizedMessage?.videoMessage) {
      return {
        mediaType: 'video',
        mimetype: normalizedMessage.videoMessage.mimetype,
        fileSize: Number(normalizedMessage.videoMessage.fileLength || 0) || undefined,
      };
    }

    if (normalizedMessage?.audioMessage) {
      return {
        mediaType: 'audio',
        mimetype: normalizedMessage.audioMessage.mimetype,
        fileSize: Number(normalizedMessage.audioMessage.fileLength || 0) || undefined,
      };
    }

    if (normalizedMessage?.documentMessage) {
      return {
        mediaType: 'document',
        mimetype: normalizedMessage.documentMessage.mimetype,
        fileSize: Number(normalizedMessage.documentMessage.fileLength || 0) || undefined,
      };
    }

    return {
      mediaType: undefined,
      mimetype: undefined,
      fileSize: undefined,
    };
  }

  private normalizeContactNumber(jid: string): string {
    return jid.split('@')[0] || jid;
  }

  private async ensureSocketReady(sessionId: string, timeoutMs = 15000) {
    const instance = this.getInstance(sessionId);

    if (instance.socket && instance.status === WhatsAppStatus.READY) {
      return instance;
    }

    await this.initializeClient(sessionId);

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const current = this.getInstance(sessionId);

      if (current.socket && current.status === WhatsAppStatus.READY) {
        return current;
      }

      if (current.status === WhatsAppStatus.QR_CODE) {
        throw new Error('WhatsApp nao conectado. Gere e escaneie o QR Code.');
      }

      await this.delay(500);
    }

    throw new Error('WhatsApp nao conectado');
  }

  private async syncChatSnapshot(sessionId: string, chat: any) {
    if (!chat?.id) return;

    const jid = chat.id;
    const isGroup = jid.includes('@g.us');
    const phone = this.normalizeContactNumber(jid);
    const info = !isGroup ? await this.getContactInfoByPhone(phone) : null;
    const name = chat.name || chat.subject || chat.pushName || chat.notify || phone;
    let profilePicUrl: string | null = null;

    try {
      const instance = this.getInstance(sessionId);
      profilePicUrl = (await instance.socket?.profilePictureUrl(jid, 'image').catch(() => undefined)) || null;
    } catch (error) {}

    const existing = await this.prisma.chatConversation.findFirst({
      where: { channel_id: sessionId, provider_uid: jid },
    });

    if (!existing) {
      await this.prisma.chatConversation.create({
        data: {
          channel_id: sessionId,
          provider_uid: jid,
          user_id: info?.userId,
          contact_name: name,
          contact_number: phone,
          profile_pic_url: profilePicUrl,
          status: 'OPEN',
          last_message: isGroup ? 'Grupo do WhatsApp' : 'Contato do WhatsApp',
          last_message_at: new Date(),
        },
      });
      return;
    }

    await this.prisma.chatConversation.update({
      where: { id: existing.id },
      data: {
        user_id: existing.user_id || info?.userId,
        contact_name:
          !existing.contact_name ||
          existing.contact_name === existing.contact_number ||
          existing.contact_name === 'NaN' ||
          existing.contact_name.endsWith('@g.us')
            ? name
            : existing.contact_name,
        contact_number: existing.contact_number || phone,
        profile_pic_url: profilePicUrl || existing.profile_pic_url,
      },
    });
  }

  private async syncChatSnapshots(sessionId: string, chats: any[] = []) {
    for (const chat of chats) {
      try {
        await this.syncChatSnapshot(sessionId, chat);
      } catch (error) {
        console.error('[WhatsApp] Erro ao sincronizar chat/grupo:', error);
      }
    }
  }

  private async getAuthRecord(sessionId: string) {
    return this.prisma.whatsappAuthState.findUnique({
      where: { session_id: sessionId },
    });
  }

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isWriteConflict(error: any) {
    return error?.code === 'P2034';
  }

  private async runAuthWrite<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.authWriteLocks.get(sessionId) || Promise.resolve();
    let release!: () => void;

    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    const chained = previous.then(() => current);
    this.authWriteLocks.set(sessionId, chained);

    await previous;

    try {
      return await task();
    } finally {
      release();
      const active = this.authWriteLocks.get(sessionId);
      if (active === chained) {
        this.authWriteLocks.delete(sessionId);
      }
    }
  }

  private async upsertAuthRecord(sessionId: string, data: Record<string, any>) {
    await this.runAuthWrite(sessionId, async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await this.prisma.whatsappAuthState.upsert({
            where: { session_id: sessionId },
            update: data,
            create: {
              session_id: sessionId,
              ...data,
            },
          });
          return;
        } catch (error) {
          if (!this.isWriteConflict(error) || attempt === 4) {
            throw error;
          }

          await this.delay(100 * (attempt + 1));
        }
      }
    });
  }

  private async clearAuthRecord(sessionId: string) {
    await this.runAuthWrite(sessionId, async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await this.prisma.whatsappAuthState.deleteMany({
            where: { session_id: sessionId },
          });
          return;
        } catch (error) {
          if (!this.isWriteConflict(error) || attempt === 4) {
            throw error;
          }

          await this.delay(100 * (attempt + 1));
        }
      }
    });
  }

  private async useMongoAuthState(sessionId: string) {
    const { BufferJSON, initAuthCreds, proto } = await this.getBaileys();
    const authRecord = await this.getAuthRecord(sessionId);
    const creds = authRecord?.creds
      ? JSON.parse(JSON.stringify(authRecord.creds), BufferJSON.reviver)
      : initAuthCreds();

    const readAuthRecord = async () => {
      return (await this.getAuthRecord(sessionId)) || {
        session_id: sessionId,
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        keys: {},
      };
    };

    return {
      state: {
        creds,
        keys: {
          get: async (type: string, ids: string[]) => {
            const latest = await readAuthRecord();
            const allKeys = (latest?.keys || {}) as Record<string, Record<string, any>>;
            const category = allKeys[type] || {};
            const data: Record<string, any> = {};

            for (const id of ids) {
              let value = category[id];
              if (value) {
                value = JSON.parse(JSON.stringify(value), BufferJSON.reviver);
              }
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }

            return data;
          },
          set: async (data: Record<string, Record<string, any>>) => {
            const latest = await readAuthRecord();
            const keys: Record<string, Record<string, any>> = {
              ...((latest.keys || {}) as Record<string, Record<string, any>>),
            };

            for (const category of Object.keys(data)) {
              const currentCategory = { ...(keys[category] || {}) };
              for (const id of Object.keys(data[category] || {})) {
                const value = data[category][id];
                if (value) {
                  currentCategory[id] = JSON.parse(
                    JSON.stringify(value, BufferJSON.replacer),
                  );
                } else {
                  delete currentCategory[id];
                }
              }

              if (Object.keys(currentCategory).length > 0) {
                keys[category] = currentCategory;
              } else {
                delete keys[category];
              }
            }

            await this.upsertAuthRecord(sessionId, { keys });
          },
        },
      },
      saveCreds: async () => {
        await this.upsertAuthRecord(sessionId, {
          creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        });
      },
    };
  }

  async initializeClient(sessionId: string) {
    const instance = this.getInstance(sessionId);
    if (
      instance.status === WhatsAppStatus.CONNECTING ||
      instance.status === WhatsAppStatus.READY
    ) {
      return;
    }

    try {
      const {
        Browsers,
        default: makeWASocket,
        fetchLatestBaileysVersion,
      } = await this.getBaileys();

      instance.status = WhatsAppStatus.CONNECTING;
      const { state, saveCreds } = await this.useMongoAuthState(sessionId);
      const { version } = await fetchLatestBaileysVersion();

      const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }) as any,
        auth: state,
        browser: Browsers.windows('Desktop'),
        connectTimeoutMs: 60000,
        markOnlineOnConnect: false,
      });

      instance.socket = socket;

      socket.ev.on('creds.update', async () => {
        await saveCreds();
      });

      socket.ev.on('messaging-history.set', ({ chats, contacts }: { chats: any[], contacts: any[] }) => {
        chats.forEach(chat => { if (chat.id) instance.chats.set(chat.id, chat); });
        contacts.forEach(contact => { if (contact.id) instance.contacts.set(contact.id, contact); });
        this.syncChatSnapshots(sessionId, chats).catch(() => undefined);
      });

      socket.ev.on('chats.upsert', (chats: any[]) => {
        chats.forEach(chat => { if (chat.id) instance.chats.set(chat.id, chat); });
        this.syncChatSnapshots(sessionId, chats).catch(() => undefined);
      });

      socket.ev.on('chats.update', (updates: any[]) => {
        updates.forEach((update: any) => {
          if (update.id) {
            const chat = instance.chats.get(update.id);
            if (chat) instance.chats.set(update.id, { ...chat, ...update });
          }
        });
        this.syncChatSnapshots(sessionId, updates.map((update: any) => ({ ...(instance.chats.get(update.id) || {}), ...update }))).catch(() => undefined);
      });

      socket.ev.on('contacts.upsert', (contacts: any[]) => {
        contacts.forEach((contact: any) => { if (contact.id) instance.contacts.set(contact.id, contact); });
      });

      socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        const disconnectCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        if (qr) {
          instance.status = WhatsAppStatus.QR_CODE;
          instance.qrCodeData = {
            qr,
            base64: await QRCode.toDataURL(qr),
          };

          await this.prisma.chatChannel.update({
            where: { id: sessionId },
            data: { status: 'QR_CODE' },
          });
        }

        if (connection === 'close') {
          const { DisconnectReason } = await this.getBaileys();
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          if (shouldReconnect) {
            instance.status = WhatsAppStatus.DISCONNECTED;
            instance.socket = null;
            instance.qrCodeData = null;
            await this.prisma.chatChannel.update({
              where: { id: sessionId },
              data: { status: 'DISCONNECTED', phone_number: null },
            });
            if (instance.retryCount < this.MAX_RETRIES) {
              instance.retryCount++;
              setTimeout(() => this.initializeClient(sessionId), this.RETRY_INTERVAL);
            }
          } else {
            instance.status = WhatsAppStatus.DISCONNECTED;
            instance.retryCount = 0;
            instance.socket = null;
            await this.prisma.chatChannel.update({
              where: { id: sessionId },
              data: { status: 'DISCONNECTED', phone_number: null },
            });
            await this.clearAuthRecord(sessionId);
          }
        } else if (connection === 'connecting') {
          instance.status = WhatsAppStatus.CONNECTING;
          await this.prisma.chatChannel.update({
            where: { id: sessionId },
            data: { status: 'CONNECTING' },
          });
        } else if (connection === 'open') {
          instance.status = WhatsAppStatus.READY;
          instance.qrCodeData = null;
          instance.retryCount = 0;

          const user = socket.user;
          if (user?.id) {
            const phone = user.id.split(':')[0].split('@')[0];
            instance.phoneNumber = phone;
            await this.prisma.chatChannel.update({
              where: { id: sessionId },
              data: { phone_number: phone, status: 'READY' }
            });
          }
        }
      });

      socket.ev.on('messages.upsert', async (m: any) => {
        if (m.type === 'notify') {
          for (const msg of m.messages) {
            if (msg.message) {
              const remoteJid = msg.key.remoteJid;
              if (!remoteJid) continue;

              const textMessage = this.getMessageText(msg.message);
              const mediaPayload = this.getMediaPayload(msg.message);
              const isGroup = remoteJid.includes('@g.us');

              let profilePicUrl = undefined;
              try {
                profilePicUrl = await socket
                  .profilePictureUrl(remoteJid, 'image')
                  .catch(() => undefined);
              } catch (e) {}

              await this.storeMessage(sessionId, remoteJid, {
                id: msg.key.id!,
                text: textMessage,
                sender: msg.key.fromMe ? 'me' : 'them',
                profilePicUrl,
                senderName: msg.pushName || msg.verifiedBizName,
                contactName: msg.pushName || msg.verifiedBizName,
                contactNumber: this.normalizeContactNumber(remoteJid),
                isGroup,
                mediaType: mediaPayload.mediaType,
                mimetype: mediaPayload.mimetype,
                fileSize: mediaPayload.fileSize,
              });

              if (!msg.key.fromMe && !isGroup && textMessage) {
                const phoneNumber = this.normalizeContactNumber(remoteJid);
                try {
                  const aiResponse = await this.aiChatService.consultarAssistente({
                    perguntaUsuario: textMessage,
                    telefoneDoUsuario: phoneNumber,
                    sessionId,
                    remoteJid,
                  });

                  if (aiResponse) {
                    const sent = await socket.sendMessage(remoteJid, { text: aiResponse });
                    await this.storeMessage(sessionId, remoteJid, {
                      id: sent?.key?.id || `${Date.now()}`,
                      text: aiResponse,
                      sender: 'me',
                      profilePicUrl,
                      contactNumber: phoneNumber,
                      contactName: msg.pushName || msg.verifiedBizName,
                      senderName: 'IA',
                    });
                  }
                } catch (err) {
                  console.error('Erro ao processar mensagem com IA:', err);
                }
              }
            }
          }
        }
      });

    } catch (error) {
      console.error(`❌ [WhatsApp] Erro na instância ${sessionId}:`, error);
      instance.status = WhatsAppStatus.DISCONNECTED;
    }
  }

  async logout(sessionId: string) {
    const instance = this.instances.get(sessionId);
    if (instance) {
      if (instance.socket) {
        try { await instance.socket.logout(); } catch (e) { }
        instance.socket.end(undefined);
      }
      this.instances.delete(sessionId);
    }
    await this.clearAuthRecord(sessionId);
    await this.prisma.chatChannel.update({
      where: { id: sessionId },
      data: { status: 'DISCONNECTED', phone_number: null }
    });
  }

  async deleteSession(sessionId: string) {
    const instance = this.instances.get(sessionId);
    if (instance) {
      if (instance.socket) {
        try {
          await instance.socket.logout();
        } catch (error) {}

        try {
          instance.socket.end(undefined);
        } catch (error) {}
      }

      this.instances.delete(sessionId);
    }

    this.messages.forEach((_, key) => {
      if (key.startsWith(`${sessionId}:`)) {
        this.messages.delete(key);
      }
    });

    await this.clearAuthRecord(sessionId);

    await this.prisma.chatMessage.deleteMany({
      where: { channel_id: sessionId },
    });

    await this.prisma.chatConversation.deleteMany({
      where: { channel_id: sessionId },
    });

    await this.prisma.chatChannelMember.deleteMany({
      where: { channel_id: sessionId },
    });

    await this.prisma.chatChannel.delete({
      where: { id: sessionId },
    });
  }

  async getStatus(sessionId: string) {
    const instance = this.getInstance(sessionId);
    if (
      !instance.socket ||
      (instance.status === WhatsAppStatus.DISCONNECTED &&
        !instance.qrCodeData)
    ) {
      await this.initializeClient(sessionId);
    }
    return {
      status: instance.status,
      qrCode: instance.qrCodeData?.qr,
      qrCodeBase64: instance.qrCodeData?.base64,
    };
  }

  async reconnect(sessionId: string) {
    const instance = this.getInstance(sessionId);

    if (instance.socket) {
      try {
        instance.socket.end(undefined);
      } catch (error) { }
    }

    instance.socket = null;
    instance.status = WhatsAppStatus.DISCONNECTED;
    instance.qrCodeData = null;
    instance.retryCount = 0;
    instance.phoneNumber = undefined;
    instance.chats.clear();
    instance.contacts.clear();

    await this.clearAuthRecord(sessionId);

    await this.prisma.chatChannel.update({
      where: { id: sessionId },
      data: { status: 'DISCONNECTED', phone_number: null },
    });

    await this.initializeClient(sessionId);
    return this.getStatus(sessionId);
  }

  async listUserSessions(userId: string) {
    const members = await this.prisma.chatChannelMember.findMany({
      where: {
        user_id: userId,
      },
      include: { channels: true }
    });
    return members.map(m => m.channels);
  }

  async userHasAccessToSession(userId: string, sessionId: string) {
    const membership = await this.prisma.chatChannelMember.findFirst({
      where: {
        user_id: userId,
        channel_id: sessionId,
      },
    });

    return Boolean(membership);
  }

  async createSession(userId: string, name: string) {
    const channel = await this.prisma.chatChannel.create({
      data: {
        company_id: 'default',
        provider: 'baileys',
        instance_name: name,
        name: name,
        status: 'DISCONNECTED',
        deleted_at: null,
      }
    });
    await this.prisma.chatChannelMember.create({
      data: {
        channel_id: channel.id,
        user_id: userId,
        deleted_at: null,
      }
    });
    return channel;
  }

  async requestPairingCode(sessionId: string, phoneNumber: string) {
    const instance = this.getInstance(sessionId);
    const { delay } = await this.getBaileys();
    if (!instance.socket) {
      await this.initializeClient(sessionId);
      await delay(2000);
    }
    if (instance.status === WhatsAppStatus.READY) {
      throw new Error('WhatsApp já está conectado!');
    }
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.length >= 10 && formattedPhone.length <= 11) {
      formattedPhone = '55' + formattedPhone;
    }
    return await instance.socket!.requestPairingCode(formattedPhone);
  }

  private filterParticipants(participants: any[], filters: any) {
    if (!filters || Object.keys(filters).length === 0) return participants;
    const keyMap: any = { state: 'estado', city: 'cidade', participantType: 'tipo', curso: 'cursos', evento: 'eventos' };
    return participants.filter(p => {
      return Object.keys(filters).every(key => {
        const fVal = filters[key];
        if (!fVal || fVal === 'all') return true;
        let pVal = p[key] || p[keyMap[key]];
        if (pVal === undefined) return false;

        if (Array.isArray(pVal)) {
          return pVal.some(item => String(item).toLowerCase().includes(String(fVal).toLowerCase()));
        }

        return String(pVal).toLowerCase().includes(String(fVal).toLowerCase());
      });
    });
  }

  async enviarMensagemSegmentada(sessionId: string, mensagem: string, participantes: any[], filtros: any, mediaUrl?: string, mediaType?: any) {
    const instance = this.getInstance(sessionId);
    if (!instance.socket || instance.status !== WhatsAppStatus.READY) {
      throw new Error('WhatsApp não está conectado');
    }
    // Usa os participantes que vieram do frontend, pois lá a seleção manual e os filtros já foram aplicados e decididos pelo Admin.
    const filtrados = participantes;
    const resultados = [];
    for (const p of filtrados) {
      try {
        let phone = p.id_contato.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = phone.substring(1);

        // Remove 9th digit for Brazil if it has 11 digits (DD9XXXXXXXX)
        if (phone.length === 11 && phone[2] === '9') {
          phone = phone.substring(0, 2) + phone.substring(3);
        }

        if (phone.length === 10 || phone.length === 11) {
          if (!phone.startsWith('55')) phone = '55' + phone;
        }
        const targetJid = `${phone}@s.whatsapp.net`;
        let payload: any = { text: mensagem.replace(/{nome}/g, p.nome || '') };
        if (mediaUrl) {
          if (mediaType === 'image') payload = { image: { url: mediaUrl }, caption: payload.text };
          else if (mediaType === 'video') payload = { video: { url: mediaUrl }, caption: payload.text };
        }
        await instance.socket.sendMessage(targetJid, payload);
        resultados.push({ contato: p.id_contato, sucesso: true });
        const { delay } = await this.getBaileys();
        await delay(3000);
      } catch (err: any) {
        resultados.push({ contato: p.id_contato, sucesso: false, erro: err.message });
      }
    }
    return { enviadas: resultados.filter(r => r.sucesso).length, falhas: resultados.filter(r => !r.sucesso).length, detalhes: resultados };
  }

  async getRecentChats(sessionId: string) {
    const instance = this.getInstance(sessionId);
    const routes = await this.agentsService.listConversationRoutes(
      '',
      'SUPER_ADMIN',
      sessionId,
    );
    const routesMap = new Map(routes.map((route: any) => [route.conversationId, route]));
    const persistedConversations = await this.prisma.chatConversation.findMany({
      where: {
        channel_id: sessionId,
        deleted_at: null,
      },
      orderBy: [{ last_message_at: 'desc' }, { updated_at: 'desc' }],
      take: 200,
    });

    const chatMap = new Map<string, any>();

    for (const conversation of persistedConversations) {
      const isGroup = conversation.provider_uid.includes('@g.us');
      const memoryChat = instance.chats.get(conversation.provider_uid);
      const memoryContact = instance.contacts.get(conversation.provider_uid);
      const liveName =
        memoryChat?.subject ||
        memoryChat?.name ||
        memoryContact?.name ||
        memoryContact?.notify;
      const fallbackName =
        liveName ||
        conversation.contact_name ||
        conversation.contact_number ||
        conversation.provider_uid.split('@')[0];
      const route = routesMap.get(conversation.id);

      chatMap.set(conversation.provider_uid, {
        id: conversation.provider_uid,
        conversationId: conversation.id,
        channelId: conversation.channel_id,
        jid: conversation.provider_uid,
        name: fallbackName,
        lastMessage:
          conversation.last_message ||
          (isGroup ? 'Grupo do WhatsApp' : 'Conversa do WhatsApp'),
        avatar:
          memoryChat?.imgUrl ||
          conversation.profile_pic_url ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=random`,
        profile_pic_url: memoryChat?.imgUrl || conversation.profile_pic_url,
        type: isGroup ? 'group' : 'person',
        unreadCount: conversation.unread_count || 0,
        contactNumber: conversation.contact_number,
        status: conversation.status,
        lastMessageAt: conversation.last_message_at,
        attendanceMode: route?.mode || 'HUMAN',
        assignedAgentId: route?.agentId || null,
        assignedAgentName: route?.agent?.name || null,
      });
    }

    for (const chat of Array.from(instance.chats.values())) {
      if (!chat?.id || chatMap.has(chat.id)) continue;

      const contact = instance.contacts.get(chat.id);
      const name =
        chat.name ||
        chat.subject ||
        contact?.name ||
        contact?.notify ||
        contact?.verifiedName ||
        chat.id.split('@')[0];

      let profilePicUrl: string | undefined;
      try {
        profilePicUrl = await instance.socket
          ?.profilePictureUrl(chat.id, 'image')
          .catch(() => undefined);
      } catch (error) {}

      chatMap.set(chat.id, {
        id: chat.id,
        jid: chat.id,
        name,
        lastMessage: chat.id.includes('@g.us')
          ? 'Grupo do WhatsApp'
          : 'Contato do WhatsApp',
        avatar:
          profilePicUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        profile_pic_url: profilePicUrl,
        type: chat.id.includes('@g.us') ? 'group' : 'person',
        unreadCount: chat.unreadCount || 0,
        contactNumber: this.normalizeContactNumber(chat.id),
      });
    }

    return Array.from(chatMap.values()).sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async createGroup(sessionId: string, name: string, participants: string[]) {
    const instance = await this.ensureSocketReady(sessionId);

    const ownerPhone = instance.phoneNumber;
    const ownerJid = ownerPhone ? `${ownerPhone}@s.whatsapp.net` : null;

    const normalizedParticipants = participants
      .map(p => this.normalizeContactJid(p))
      .filter((jid): jid is string => Boolean(jid));

    const uniqueParticipants = Array.from(new Set(normalizedParticipants))
      .filter(jid => jid !== ownerJid && jid !== instance.socket?.user?.id);

    if (uniqueParticipants.length === 0) {
      throw new Error('Selecione pelo menos um participante (que não seja você mesmo).');
    }

    // WhatsApp group name limit is usually 25 chars for some older clients, or 100 for newer.
    // Let's truncate to 25 to be safe or at least log it.
    const safeName = name.substring(0, 25);

    console.log(`[WhatsApp] Criando grupo "${safeName}" com ${uniqueParticipants.length} participantes. Sessão: ${sessionId}`);
    console.log(`[WhatsApp] Participantes:`, uniqueParticipants);

    try {
      const group = await instance.socket!.groupCreate(safeName, uniqueParticipants);
      return { success: true, group };
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao criar grupo:', error);
      // Detailed error if possible
      const errorMessage = error.message || 'Erro desconhecido no Baileys';
      throw new Error(`Erro ao criar grupo: ${errorMessage}`);
    }
  }

  async addParticipantsToGroup(sessionId: string, groupId: string, participants: string[]) {
    const instance = await this.ensureSocketReady(sessionId);
    const normalizedGroupId = this.normalizeGroupId(groupId);

    const ownerPhone = instance.phoneNumber;
    const ownerJid = ownerPhone ? `${ownerPhone}@s.whatsapp.net` : null;

    const normalizedParticipants = (participants || [])
      .map(p => this.normalizeContactJid(p))
      .filter((jid): jid is string => Boolean(jid));

    const uniqueParticipants = Array.from(new Set(normalizedParticipants))
      .filter(jid => jid !== ownerJid && jid !== instance.socket?.user?.id);

    if (uniqueParticipants.length === 0) {
      throw new Error('Informe ao menos um participante válido para adicionar.');
    }

    try {
      await instance.socket!.groupParticipantsUpdate(normalizedGroupId, uniqueParticipants, 'add');
      return { success: true, added: uniqueParticipants.length, groupId: normalizedGroupId };
    } catch (error: any) {
      console.error(`[WhatsApp] Erro ao adicionar participantes no grupo ${normalizedGroupId}:`, error);
      const errorMessage = error?.message || 'Erro desconhecido';
      throw new Error(`Erro ao adicionar participantes: ${errorMessage}`);
    }
  }

  async getGroups(sessionId: string) {
    const instance = await this.ensureSocketReady(sessionId);
    const groups = await (instance.socket as any).groupFetchAllFull();
    const normalizedGroups = await Promise.all(
      Object.values(groups).map(async (g: any) => {
        let profilePicUrl: string | undefined;
        try {
          profilePicUrl = await instance.socket
            ?.profilePictureUrl(g.id, 'image')
            .catch(() => undefined);
        } catch (error) {}

        return {
          id: g.id,
          jid: g.id,
          name: g.subject,
          participants: g.participants?.length || 0,
          avatar:
            profilePicUrl ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(g.subject || g.id)}&background=random`,
          profile_pic_url: profilePicUrl,
          type: 'group',
          lastMessage: 'Grupo do WhatsApp',
        };
      }),
    );
  }

  async enviarMensagemDireta(sessionId: string, jid: string, mensagem: string) {
    const instance = this.instances.get(sessionId);
    if (!instance?.socket || instance.status !== WhatsAppStatus.READY) throw new Error('WhatsApp não conectado');

    let target = jid.includes('@') ? jid : jid.replace(/\D/g, '');
    if (!target.includes('@')) {
      if (target.startsWith('0')) target = target.substring(1);

      // Remove 9th digit for Brazil
      if (target.length === 11 && target[2] === '9') {
        target = target.substring(0, 2) + target.substring(3);
      }

      if ((target.length === 10 || target.length === 11) && !target.startsWith('55')) {
        target = '55' + target;
      }
      target = `${target}@s.whatsapp.net`;
    }
    const result = await instance.socket.sendMessage(target, { text: mensagem });

    await this.storeMessage(sessionId, target, {
      id: result?.key?.id || Date.now().toString(),
      text: mensagem,
      sender: 'me',
      senderName: 'Atendente',
      contactNumber: this.normalizeContactNumber(target),
    });

    return { success: true, messageId: result?.key?.id };
  }

  /**
   * Envia uma mensagem para um número usando a primeira instância disponível que esteja READY.
   */
  async sendMessageToPhone(phone: string, text: string) {
    let readyInstance: WhatsAppInstance | null = null;

    for (const [, instance] of this.instances) {
      if (instance.status === WhatsAppStatus.READY && instance.socket) {
        readyInstance = instance;
        break;
      }
    }

    if (!readyInstance) {
      console.warn(`[WhatsApp] Nenhuma instância READY disponível para enviar mensagem para ${phone}`);
      return;
    }

    try {
      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);

      // Remove 9th digit for Brazil
      if (formattedPhone.length === 11 && formattedPhone[2] === '9') {
        formattedPhone = formattedPhone.substring(0, 2) + formattedPhone.substring(3);
      }

      if ((formattedPhone.length === 10 || formattedPhone.length === 11) && !formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      const jid = `${formattedPhone}@s.whatsapp.net`;

      await readyInstance.socket!.sendMessage(jid, { text });
      console.log(`[WhatsApp] Mensagem automática enviada para ${phone}`);
    } catch (error) {
      console.error(`[WhatsApp] Erro ao enviar mensagem automática para ${phone}:`, error);
    }
  }

  private async storeMessage(sessionId: string, jid: string, message: StoredMessageInput) {
    try {
      const instance = this.getInstance(sessionId);
      const isGroup = message.isGroup ?? jid.includes('@g.us');
      const phone = this.normalizeContactNumber(jid);
      const info: ContactInfoResult | null = !isGroup
        ? await this.getContactInfoByPhone(phone)
        : null;
      const memoryChat = instance.chats.get(jid);
      const memoryContact = instance.contacts.get(jid);
      const fallbackName = isGroup
        ? memoryChat?.subject || memoryChat?.name || message.contactName || message.senderName || phone
        : message.contactName || info?.name || memoryContact?.name || memoryContact?.notify || phone;

      let conversation = await this.prisma.chatConversation.findFirst({
        where: { channel_id: sessionId, provider_uid: jid }
      });

      if (!conversation) {
        conversation = await this.prisma.chatConversation.create({
          data: {
            channel_id: sessionId,
            provider_uid: jid,
            user_id: info?.userId,
            contact_name: fallbackName,
            contact_number: phone,
            profile_pic_url: message.profilePicUrl,
            status: 'OPEN'
          }
        });
      }

      const contentType = message.mediaType || 'text';
      const alreadyExists = await this.prisma.chatMessage.findFirst({
        where: {
          conversation_id: conversation.id,
          provider_msg_id: message.id,
        }
      });

      if (!alreadyExists) {
        await this.prisma.chatMessage.create({
          data: {
            conversation_id: conversation.id,
            channel_id: sessionId,
            provider_msg_id: message.id,
            direction: message.sender === 'me' ? 'OUTGOING' : 'INCOMING',
            content: message.text,
            content_type: contentType,
            media_url: message.mediaUrl,
            media_type: message.mediaType,
            file_size: message.fileSize,
            mimetype: message.mimetype,
            sender_name: message.senderName || fallbackName,
            status: message.sender === 'me' ? 'SENT' : 'DELIVERED',
          }
        });
      }

      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: {
          user_id: conversation.user_id || info?.userId,
          contact_name: fallbackName,
          contact_number: phone,
          last_message: message.text || `[${contentType}]`,
          last_message_at: new Date(),
          unread_count: message.sender === 'them' ? { increment: 1 } : undefined,
          profile_pic_url: message.profilePicUrl || conversation.profile_pic_url
        }
      });

    } catch (error) {
      console.error('[WhatsApp] Erro ao persistir mensagem:', error);
    }
  }

  async getMessages(sessionId: string, jid: string) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { channel_id: sessionId, provider_uid: jid },
      include: {
        messages: {
          orderBy: { sent_at: 'asc' },
          take: 50
        }
      }
    });

    if (!conversation) return [];

    await this.prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { unread_count: 0 },
    });

    return conversation.messages.map(m => ({
      id: m.id,
      text: m.content || (m.media_type ? `[${m.media_type}]` : ''),
      time: m.sent_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sender: m.direction === 'OUTGOING' ? 'me' : 'them',
      status: m.status.toLowerCase(),
      senderName: m.sender_name,
      mediaType: m.media_type,
      mediaUrl: m.media_url,
    }));
  }

  async getContactInfoByPhone(phone: string): Promise<ContactInfoResult> {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('55')) cleanPhone = cleanPhone.substring(2);
    // Também tenta com o 9 à esquerda se for o caso
    const phoneVariants = [cleanPhone];
    if (cleanPhone.length === 10) phoneVariants.push(cleanPhone.substring(0, 2) + '9' + cleanPhone.substring(2));
    else if (cleanPhone.length === 11 && cleanPhone[2] === '9') phoneVariants.push(cleanPhone.substring(0, 2) + cleanPhone.substring(3));

    const user = await this.prisma.user.findFirst({
      where: { phone: { in: phoneVariants } },
      include: {
        enrollments: { include: { course: true } },
        registrations: { include: { event: true } }
      }
    });

    const registrations = await this.prisma.registration.findMany({
      where: { phone: { in: phoneVariants } },
      include: { event: true }
    });

    if (!user && registrations.length === 0) {
      return {
        userId: undefined,
        name: null,
        role: null,
        email: null,
        phone: phoneVariants[0] || null,
        city: null,
        state: null,
        participantType: null,
        source: 'unknown',
        courses: [],
        events: [],
      };
    }

    const fallbackRegistration = registrations[0];

    return {
      userId: user?.id,
      name: user?.name || fallbackRegistration?.name,
      role: user?.participantType || fallbackRegistration?.participantType,
      email: user?.email || null,
      phone: user?.phone || fallbackRegistration?.phone || phoneVariants[0] || null,
      city: user?.city || fallbackRegistration?.city || null,
      state: user?.state || fallbackRegistration?.state || null,
      participantType: user?.participantType || fallbackRegistration?.participantType || null,
      source: user ? 'user' : 'registration',
      courses: user?.enrollments.map(e => e.course.title) || [],
      events: [...new Set([
        ...(user?.registrations.map(r => r.event.title) || []),
        ...registrations.map(r => r.event.title)
      ])]
    };
  }

  async getParticipants() {
    const users = await this.prisma.user.findMany({ where: { phone: { not: null } } });
    const regs = await this.prisma.registration.findMany({ include: { event: true } });
    const mapped = [
      ...users.map(u => ({ id_contato: u.phone, nome: u.name, tipo: u.participantType, estado: u.state, cidade: u.city, origem: 'users' })),
      ...regs.map(r => ({ id_contato: r.phone, nome: r.name, tipo: r.participantType, estado: r.state, cidade: r.city, origem: 'registrations' }))
    ];
    return mapped;
  }
}


