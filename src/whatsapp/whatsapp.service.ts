import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay,
  WASocket,
  AuthenticationState,
} from '@whiskeysockets/baileys';
import * as qrcodeTerminal from 'qrcode-terminal';
import * as QRCode from 'qrcode';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { Boom } from '@hapi/boom';
import pino from 'pino';

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

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private socket: WASocket | null = null;
  private status: WhatsAppStatus = WhatsAppStatus.DISCONNECTED;
  private qrCodeData: QRCodeData | null = null;
  private sessionPath: string;
  private RETRY_INTERVAL = 5000;
  private MAX_RETRIES = 5;
  private retryCount = 0;

  constructor(private readonly prisma: PrismaService) {
    this.sessionPath = join(process.cwd(), '.baileys_auth');
    if (!existsSync(this.sessionPath)) {
      mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  async onModuleInit() {
    console.log('🚀 [WhatsApp Baileys] Serviço pronto para inicialização');
  }

  async onModuleDestroy() {
    if (this.socket) {
      this.socket.end(undefined);
    }
  }

  async initializeClient() {
    // Evitar múltiplas inicializações
    if (this.status === WhatsAppStatus.CONNECTING || this.status === WhatsAppStatus.READY) {
      return;
    }

    try {
      this.status = WhatsAppStatus.CONNECTING;
      console.log('🔄 [WhatsApp Baileys] Inicializando cliente...');

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      console.log(`ℹ️ [WhatsApp Baileys] Versão: ${version.join('.')}`);

      this.socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }) as any,
        printQRInTerminal: true, // Garante que o QR aparece no terminal se não usar pairing code
        auth: state,
        browser: ['LinkDeCadastro', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
      });

      // Gerenciamento de credenciais
      this.socket.ev.on('creds.update', saveCreds);

      // Gerenciamento de conexão
      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = WhatsAppStatus.QR_CODE;
          this.qrCodeData = {
            qr,
            base64: await QRCode.toDataURL(qr),
          };
          console.log('\n📱 [WhatsApp Baileys] QR Code gerado!');
          // qrcodeTerminal.generate(qr, { small: true }); // makeWASocket já imprime se printQRInTerminal: true
        }

        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

          console.log(
            '⚠️ [WhatsApp Baileys] Conexão fechada devido a ',
            lastDisconnect?.error,
            ', reconectar: ',
            shouldReconnect,
          );

          if (shouldReconnect) {
            this.status = WhatsAppStatus.DISCONNECTED;
            if (this.retryCount < this.MAX_RETRIES) {
              this.retryCount++;
              console.log(`🔄 [WhatsApp Baileys] Tentando reconectar (${this.retryCount}/${this.MAX_RETRIES})...`);
              setTimeout(() => this.initializeClient(), this.RETRY_INTERVAL);
            }
          } else {
            console.log('❌ [WhatsApp Baileys] Desconectado permanentemente (Logout). Limpe a sessão para reconectar.');
            this.status = WhatsAppStatus.DISCONNECTED;
            this.retryCount = 0;
            this.socket = null;
            // Opcional: limpar pasta de sessão automaticamente
             if (existsSync(this.sessionPath)) {
               rmSync(this.sessionPath, { recursive: true, force: true });
             }
          }
        } else if (connection === 'open') {
          console.log('✅ [WhatsApp Baileys] Conectado e autenticado!');
          this.status = WhatsAppStatus.READY;
          this.qrCodeData = null;
          this.retryCount = 0;
        }
      });

    } catch (error) {
      console.error('❌ [WhatsApp Baileys] Erro fatal na inicialização:', error);
      this.status = WhatsAppStatus.DISCONNECTED;
    }
  }

  async getStatus(): Promise<{
    status: WhatsAppStatus;
    qrCode?: string;
    qrCodeBase64?: string;
  }> {
    if (!this.socket) {
      await this.initializeClient();
    }
    
    // Pequeno delay para garantir que eventos assíncronos (como QR) sejam processados
    if (this.status === WhatsAppStatus.CONNECTING) {
        await delay(1000);
    }

    return {
      status: this.status,
      qrCode: this.qrCodeData?.qr,
      qrCodeBase64: this.qrCodeData?.base64,
    };
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      await this.initializeClient();
      // Aguardar socket conectar
      await delay(2000); 
    }
    
    // Se já estiver pronto, não precisa parear
    if (this.status === WhatsAppStatus.READY) {
         throw new Error('WhatsApp já está conectado!');
    }

    if (!phoneNumber) {
      throw new Error('Número de telefone é obrigatório');
    }

    // Formatar número
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.length >= 10 && formattedPhone.length <= 11) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`📱 [WhatsApp Baileys] Solicitando código de pareamento para: ${formattedPhone}`);
    
    try {
        // Importante: pairing code no Baileys requer que o socket esteja inicializado mas NÃO autenticado
        const code = await this.socket!.requestPairingCode(formattedPhone);
        console.log(`✅ [WhatsApp Baileys] Código gerado: ${code}`);
        return code;
    } catch (error: any) {
        console.error('❌ [WhatsApp Baileys] Erro ao solicitar código:', error);
        throw new Error(`Erro ao gerar código: ${error.message}`);
    }
  }
  
  // Funções de filtro auxiliares mantidas iguais
  private filterParticipants(
    participants: Array<{ id_contato: string; [key: string]: any }>,
    filters: { [key: string]: any },
  ): Array<{ id_contato: string; [key: string]: any }> {
     // ... (Lógica de filtro idêntica à original, omitida para brevidade se não mudou)
     // Vou copiar a lógica exata do arquivo original para garantir compatibilidade
    if (!filters || Object.keys(filters).length === 0) {
      return participants;
    }

    const keyMap: { [key: string]: string } = {
      'state': 'estado',
      'city': 'cidade',
      'participantType': 'tipo',
      'type': 'tipo',
      'role': 'role', 
      'course': 'cursos',
      'curso': 'cursos',
      'courses': 'cursos',
      'estado': 'state',
      'cidade': 'city',
      'tipo': 'participantType',
    };

    return participants.filter((participant) => {
      return Object.keys(filters).every((key) => {
        const filterValue = filters[key];
        if (filterValue === null || filterValue === undefined || filterValue === '' || filterValue === 'Todos') return true;

        if ((key === 'type' || key === 'tipo') && typeof filterValue === 'string' && ['curso', 'evento', 'course', 'event'].includes(filterValue.toLowerCase())) {
          return true;
        }

        let participantValue = participant[key];
        if (participantValue === undefined && keyMap[key]) {
          participantValue = participant[keyMap[key]];
        }
        if (participantValue === undefined) {
          const reverseKey = Object.keys(keyMap).find(k => keyMap[k] === key);
          if (reverseKey && participant[reverseKey] !== undefined) {
             participantValue = participant[reverseKey];
          }
        }

        if (participantValue === undefined) return false;

        if (Array.isArray(participantValue)) {
          if (typeof filterValue === 'string') {
            const fValStr = filterValue.toLowerCase().trim();
            return participantValue.some(pVal => String(pVal).toLowerCase().trim() === fValStr || String(pVal).toLowerCase().trim().includes(fValStr));
          }
        }

        if (typeof filterValue === 'boolean' || typeof filterValue === 'number') return participantValue === filterValue;

        if (typeof filterValue === 'string') {
          const pValStr = String(participantValue).toLowerCase().trim();
          const fValStr = filterValue.toLowerCase().trim();
          return pValStr === fValStr || pValStr.includes(fValStr);
        }
        return participantValue == filterValue;
      });
    });
  }

  async criarGrupoFiltrado(
    tituloGrupo: string,
    participantes: Array<{ id_contato: string; [key: string]: any }>,
    filtros: { [key: string]: any },
  ): Promise<{
    grupoId: string;
    participantesAdicionados: string[];
    totalFiltrados: number;
  }> {
     if (!this.socket || this.status !== WhatsAppStatus.READY) {
      throw new Error('WhatsApp não está conectado. Status: ' + this.status);
    }

    const participantesFiltrados = this.filterParticipants(participantes, filtros);
    if (participantesFiltrados.length === 0) throw new Error('Nenhum participante atende aos critérios');

    // Baileys usa formato JID (12345678@s.whatsapp.net) para usuários
    // Precisamos converter ids de contato se estiverem em formato diferente
    const contatosIds = participantesFiltrados.map((p) => {
        let id = p.id_contato;
        if (id.includes('@c.us')) id = id.replace('@c.us', '@s.whatsapp.net');
        return id;
    });

    try {
      const groupData = await this.socket.groupCreate(tituloGrupo, contatosIds);
      const grupoId = groupData.id;

      return {
        grupoId,
        participantesAdicionados: contatosIds,
        totalFiltrados: participantesFiltrados.length,
      };
    } catch (error: any) {
      throw new Error(`Erro ao criar grupo: ${error.message}`);
    }
  }

  async enviarMensagemSegmentada(
    mensagem: string,
    participantes: Array<{ id_contato: string; nome?: string; [key: string]: any }>,
    filtros: { [key: string]: any },
  ): Promise<{
    enviadas: number;
    falhas: number;
    detalhes: Array<{ contato: string; sucesso: boolean; erro?: string }>;
  }> {
     if (!this.socket || this.status !== WhatsAppStatus.READY) {
      throw new Error('WhatsApp não está conectado. Status: ' + this.status);
    }

    const participantesFiltrados = this.filterParticipants(participantes, filtros);
    if (participantesFiltrados.length === 0) throw new Error('Nenhum participante atende aos filtros');

    const resultados: any[] = [];

    for (const participante of participantesFiltrados) {
      try {
        let mensagemPersonalizada = mensagem;
        if (participante.nome) {
          mensagemPersonalizada = mensagemPersonalizada.replace(/{nome}/g, participante.nome);
        } else {
          mensagemPersonalizada = mensagemPersonalizada.replace(/{nome}/g, '').replace(/Olá, !/g, 'Olá!').replace(/Olá, /g, 'Olá! ');
        }
        
        // Baileys JID format check
        let jid = participante.id_contato;
        if (jid.includes('@c.us')) jid = jid.replace('@c.us', '@s.whatsapp.net');

        await this.socket.sendMessage(jid, { text: mensagemPersonalizada });
        resultados.push({ contato: participante.id_contato, sucesso: true });
        
        // Anti-ban delay
        await delay(1000 + Math.random() * 2000); 

      } catch (error: any) {
        resultados.push({ contato: participante.id_contato, sucesso: false, erro: error.message });
      }
    }

    const enviadas = resultados.filter((r) => r.sucesso).length;
    const falhas = resultados.filter((r) => !r.sucesso).length;

    return { enviadas, falhas, detalhes: resultados };
  }

  async enviarMensagemGrupo(grupoId: string, mensagem: string): Promise<{ sucesso: boolean; mensagemId?: string; erro?: string }> {
     if (!this.socket || this.status !== WhatsAppStatus.READY) {
      throw new Error('WhatsApp não está conectado. Status: ' + this.status);
    }

    try {
      // Garantir formato JID de grupo
      let chatId = grupoId;
      if (!chatId.includes('@g.us')) chatId = `${chatId}@g.us`;
      
      const result = await this.socket.sendMessage(chatId, { text: mensagem });

      return { sucesso: true, mensagemId: result?.key?.id || undefined };
    } catch (error: any) {
      return { sucesso: false, erro: error.message };
    }
  }

  async getParticipants() {
    const users = await this.prisma.user.findMany({
      where: { phone: { not: null } },
      select: {
        id: true, name: true, phone: true, email: true, role: true, participantType: true, state: true, city: true,
        enrollments: { include: { course: { select: { title: true } } } },
      },
    });

    return users
      .filter((user) => user.phone && user.phone.length >= 10)
      .map((user) => {
        let phone = user.phone!.replace(/\D/g, '');
        if (phone.startsWith('0') && phone.length > 11) phone = phone.substring(1);
        if (phone.length >= 10 && phone.length <= 11) phone = '55' + phone;

        return {
          id: user.id,
          id_contato: `${phone}@c.us`, // Manter @c.us aqui para compatibilidade com logs antigos, converto para @s.whatsapp.net no envio
          nome: user.name,
          email: user.email,
          role: user.role,
          tipo: user.participantType,
          estado: user.state,
          cidade: user.city,
          cursos: user.enrollments.map((e) => e.course.title),
        };
      });
  }

  async isReady(): Promise<boolean> {
    return this.status === WhatsAppStatus.READY && this.socket !== null;
  }
}
