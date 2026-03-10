import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay,
  WASocket,
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { AiChatService } from './ai-chat.service';

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

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private instances: Map<string, WhatsAppInstance> = new Map();
  private messages: Map<string, any[]> = new Map(); // sessionId:jid -> messages[]
  private authBaseDir: string;
  private RETRY_INTERVAL = 5000;
  private MAX_RETRIES = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService
  ) {
    this.authBaseDir = join(process.cwd(), '.baileys_auth');
    if (!existsSync(this.authBaseDir)) {
      mkdirSync(this.authBaseDir, { recursive: true });
    }
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

  private getSessionPath(sessionId: string): string {
    const path = join(this.authBaseDir, sessionId);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
    return path;
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
      instance.status = WhatsAppStatus.CONNECTING;
      const sessionPath = this.getSessionPath(sessionId);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      instance.socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }) as any,
        auth: state,
        browser: ['LinkDeCadastro', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
      });

      instance.socket.ev.on('creds.update', saveCreds);

      instance.socket.ev.on('messaging-history.set', ({ chats, contacts }) => {
        chats.forEach(chat => { if (chat.id) instance.chats.set(chat.id, chat); });
        contacts.forEach(contact => { if (contact.id) instance.contacts.set(contact.id, contact); });
      });

      instance.socket.ev.on('chats.upsert', (chats) => {
        chats.forEach(chat => { if (chat.id) instance.chats.set(chat.id, chat); });
      });

      instance.socket.ev.on('chats.update', (updates) => {
        updates.forEach(update => {
          if (update.id) {
            const chat = instance.chats.get(update.id);
            if (chat) instance.chats.set(update.id, { ...chat, ...update });
          }
        });
      });

      instance.socket.ev.on('contacts.upsert', (contacts) => {
        contacts.forEach(contact => { if (contact.id) instance.contacts.set(contact.id, contact); });
      });

      instance.socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          instance.status = WhatsAppStatus.QR_CODE;
          instance.qrCodeData = {
            qr,
            base64: await QRCode.toDataURL(qr),
          };
        }

        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          if (shouldReconnect) {
            instance.status = WhatsAppStatus.DISCONNECTED;
            if (instance.retryCount < this.MAX_RETRIES) {
              instance.retryCount++;
              setTimeout(() => this.initializeClient(sessionId), this.RETRY_INTERVAL);
            }
          } else {
            instance.status = WhatsAppStatus.DISCONNECTED;
            instance.retryCount = 0;
            instance.socket = null;
            if (existsSync(sessionPath)) {
              rmSync(sessionPath, { recursive: true, force: true });
            }
          }
        } else if (connection === 'open') {
          instance.status = WhatsAppStatus.READY;
          instance.qrCodeData = null;
          instance.retryCount = 0;

          const user = instance.socket?.user;
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

      instance.socket.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
          for (const msg of m.messages) {
            if (msg.message) {
              const remoteJid = msg.key.remoteJid;
              if (!remoteJid) continue;

              const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

              if (textMessage) {
                // Tenta pegar a foto de perfil se for nova conversa
                let profilePicUrl = undefined;
                try {
                  if (!msg.key.fromMe && instance.socket) {
                    profilePicUrl = await instance.socket.profilePictureUrl(remoteJid, 'image').catch(() => undefined);
                  }
                } catch (e) { }

                await this.storeMessage(sessionId, remoteJid, {
                  id: msg.key.id!,
                  text: textMessage,
                  sender: msg.key.fromMe ? 'me' : 'them',
                  profilePicUrl
                });
              }

              // IA Auto-reply (only if not from me)
              if (!msg.key.fromMe && !remoteJid.includes('@g.us')) {
                const phoneNumber = remoteJid.split('@')[0];
                if (phoneNumber && textMessage && instance.socket) {
                  try {
                    const aiResponse = await this.aiChatService.consultarAssistente(textMessage, phoneNumber);
                    if (aiResponse) {
                      await instance.socket.sendMessage(remoteJid, { text: aiResponse });
                    }
                  } catch (err) {
                    console.error('Erro ao processar mensagem com IA:', err);
                  }
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
    const sessionPath = this.getSessionPath(sessionId);
    if (existsSync(sessionPath)) {
      rmSync(sessionPath, { recursive: true, force: true });
    }
    await this.prisma.chatChannel.update({
      where: { id: sessionId },
      data: { status: 'DISCONNECTED', phone_number: null }
    });
  }

  async getStatus(sessionId: string) {
    const instance = this.getInstance(sessionId);
    if (!instance.socket) {
      await this.initializeClient(sessionId);
    }
    return {
      status: instance.status,
      qrCode: instance.qrCodeData?.qr,
      qrCodeBase64: instance.qrCodeData?.base64,
    };
  }

  async listUserSessions(userId: string) {
    const members = await this.prisma.chatChannelMember.findMany({
      where: { user_id: userId },
      include: { channels: true }
    });
    return members.map(m => m.channels);
  }

  async createSession(userId: string, name: string) {
    const channel = await this.prisma.chatChannel.create({
      data: {
        company_id: 'default',
        provider: 'baileys',
        instance_name: name,
        name: name,
        status: 'DISCONNECTED',
      }
    });
    await this.prisma.chatChannelMember.create({
      data: {
        channel_id: channel.id,
        user_id: userId
      }
    });
    return channel;
  }

  async requestPairingCode(sessionId: string, phoneNumber: string) {
    const instance = this.getInstance(sessionId);
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
        await delay(3000);
      } catch (err: any) {
        resultados.push({ contato: p.id_contato, sucesso: false, erro: err.message });
      }
    }
    return { enviadas: resultados.filter(r => r.sucesso).length, falhas: resultados.filter(r => !r.sucesso).length, detalhes: resultados };
  }

  async getRecentChats(sessionId: string) {
    const instance = this.instances.get(sessionId);
    if (!instance) return [];

    const chats = Array.from(instance.chats.values()).map(chat => {
      const contact = instance.contacts.get(chat.id);
      return {
        id: chat.id,
        jid: chat.id,
        name: contact?.name || contact?.notify || contact?.verifiedName || chat.id.split('@')[0],
        lastMessage: 'Mensagem do WhatsApp',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.id)}&background=random`,
        type: chat.id.includes('@g.us') ? 'group' : 'person',
        unreadCount: chat.unreadCount || 0,
      };
    });

    return chats;
  }

  async createGroup(sessionId: string, name: string, participants: string[]) {
    const instance = this.instances.get(sessionId);
    if (!instance?.socket || instance.status !== WhatsAppStatus.READY) throw new Error('WhatsApp não conectado');

    const ownerPhone = instance.phoneNumber;
    const ownerJid = ownerPhone ? `${ownerPhone}@s.whatsapp.net` : null;

    // Remove duplicates, ensure JIDs are valid and remove the owner (added automatically)
    const uniqueParticipants = [...new Set(participants)]
      .map(p => {
        let jid = p.includes('@') ? p : `${p.replace(/\D/g, '')}@s.whatsapp.net`;
        if (!jid.includes(':') && jid.includes('@s.whatsapp.net') && !jid.startsWith('55') && jid.split('@')[0].length <= 11) {
          // Fallback for missing country code if not present
          // But normally frontend already adds it.
        }
        return jid;
      })
      .filter(p => p !== ownerJid && p !== instance.socket?.user?.id);

    if (uniqueParticipants.length === 0) {
      throw new Error('Selecione pelo menos um participante (que não seja você mesmo).');
    }

    // WhatsApp group name limit is usually 25 chars for some older clients, or 100 for newer.
    // Let's truncate to 25 to be safe or at least log it.
    const safeName = name.substring(0, 25);

    console.log(`[WhatsApp] Criando grupo "${safeName}" com ${uniqueParticipants.length} participantes. Sessão: ${sessionId}`);
    console.log(`[WhatsApp] Participantes:`, uniqueParticipants);

    try {
      const group = await instance.socket.groupCreate(safeName, uniqueParticipants);
      return { success: true, group };
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao criar grupo:', error);
      // Detailed error if possible
      const errorMessage = error.message || 'Erro desconhecido no Baileys';
      throw new Error(`Erro ao criar grupo: ${errorMessage}`);
    }
  }

  async getGroups(sessionId: string) {
    const instance = this.getInstance(sessionId);
    if (!instance.socket || instance.status !== WhatsAppStatus.READY) throw new Error('WhatsApp não conectado');
    const groups = await (instance.socket as any).groupFetchAllFull();
    return Object.values(groups).map((g: any) => ({ id: g.id, name: g.subject, participants: g.participants?.length || 0 }));
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
      sender: 'me'
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

  private async storeMessage(sessionId: string, jid: string, message: { id: string, text: string, sender: 'me' | 'them', profilePicUrl?: string }) {
    try {
      // Busca a conversa no banco
      let conversation = await this.prisma.chatConversation.findFirst({
        where: { channel_id: sessionId, provider_uid: jid }
      });

      if (!conversation) {
        // Se for uma nova conversa, busca se é um contato do CRM pra pegar o nome
        const phone = jid.split('@')[0];
        const info = await this.getContactInfoByPhone(phone);

        conversation = await this.prisma.chatConversation.create({
          data: {
            channel_id: sessionId,
            provider_uid: jid,
            contact_name: info.name || jid.split('@')[0],
            contact_number: phone,
            profile_pic_url: message.profilePicUrl,
            status: 'OPEN'
          }
        });
      }

      // Salva a mensagem
      await this.prisma.chatMessage.create({
        data: {
          conversation_id: conversation.id,
          channel_id: sessionId,
          provider_msg_id: message.id,
          direction: message.sender === 'me' ? 'OUTGOING' : 'INCOMING',
          content: message.text,
          content_type: 'text'
        }
      });

      // Atualiza a conversa
      await this.prisma.chatConversation.update({
        where: { id: conversation.id },
        data: {
          last_message: message.text,
          last_message_at: new Date(),
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

    return conversation.messages.map(m => ({
      id: m.id,
      text: m.content,
      time: m.sent_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sender: m.direction === 'OUTGOING' ? 'me' : 'them',
      status: m.status.toLowerCase()
    }));
  }

  async getContactInfoByPhone(phone: string) {
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

    if (!user && registrations.length === 0) return { name: null, role: null, courses: [], events: [] };

    return {
      name: user?.name || registrations[0]?.name,
      role: user?.participantType || registrations[0]?.participantType,
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
