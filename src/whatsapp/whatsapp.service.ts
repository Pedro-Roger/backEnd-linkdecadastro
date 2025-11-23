import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

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
  private client: Client | null = null;
  private status: WhatsAppStatus = WhatsAppStatus.DISCONNECTED;
  private qrCodeData: QRCodeData | null = null;
  private sessionPath: string;

  constructor() {
    // Criar diretório para sessões se não existir
    this.sessionPath = join(process.cwd(), '.wwebjs_auth');
    if (!existsSync(this.sessionPath)) {
      mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  async onModuleInit() {
    await this.initializeClient();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.destroy();
    }
  }

  private async initializeClient() {
    if (this.client) {
      return;
    }

    try {
      this.status = WhatsAppStatus.CONNECTING;

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: this.sessionPath,
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ],
        },
      });

      // Evento de QR Code
      this.client.on('qr', async (qr) => {
        this.status = WhatsAppStatus.QR_CODE;
        try {
          const base64 = await QRCode.toDataURL(qr);
          this.qrCodeData = {
            qr,
            base64,
          };
        } catch (error) {
          console.error('Erro ao gerar QR Code em base64:', error);
        }
      });

      // Evento de autenticação
      this.client.on('authenticated', () => {
        this.status = WhatsAppStatus.AUTHENTICATED;
        this.qrCodeData = null;
      });

      // Evento de autenticação falhada
      this.client.on('auth_failure', () => {
        this.status = WhatsAppStatus.AUTH_FAILURE;
        this.qrCodeData = null;
      });

      // Evento de ready
      this.client.on('ready', () => {
        this.status = WhatsAppStatus.READY;
        this.qrCodeData = null;
      });

      // Evento de desconexão
      this.client.on('disconnected', () => {
        this.status = WhatsAppStatus.DISCONNECTED;
        this.client = null;
      });

      // Inicializar cliente
      await this.client.initialize();
    } catch (error) {
      console.error('Erro ao inicializar cliente WhatsApp:', error);
      this.status = WhatsAppStatus.DISCONNECTED;
      throw error;
    }
  }

  async getStatus(): Promise<{
    status: WhatsAppStatus;
    qrCode?: string;
    qrCodeBase64?: string;
  }> {
    if (!this.client) {
      await this.initializeClient();
    }

    return {
      status: this.status,
      qrCode: this.qrCodeData?.qr,
      qrCodeBase64: this.qrCodeData?.base64,
    };
  }

  private filterParticipants(
    participants: Array<{
      id_contato: string;
      [key: string]: any;
    }>,
    filters: {
      [key: string]: any;
    },
  ): Array<{ id_contato: string; [key: string]: any }> {
    if (!filters || Object.keys(filters).length === 0) {
      return participants;
    }

    return participants.filter((participant) => {
      return Object.keys(filters).every((key) => {
        const filterValue = filters[key];
        const participantValue = participant[key];

        // Comparação estrita
        return participantValue === filterValue;
      });
    });
  }

  async criarGrupoFiltrado(
    tituloGrupo: string,
    participantes: Array<{
      id_contato: string;
      [key: string]: any;
    }>,
    filtros: {
      [key: string]: any;
    },
  ): Promise<{
    grupoId: string;
    participantesAdicionados: string[];
    totalFiltrados: number;
  }> {
    if (!this.client || this.status !== WhatsAppStatus.READY) {
      throw new Error('WhatsApp não está conectado. Status: ' + this.status);
    }

    // Filtrar participantes
    const participantesFiltrados = this.filterParticipants(participantes, filtros);

    if (participantesFiltrados.length === 0) {
      throw new Error('Nenhum participante atende aos critérios de filtros especificados');
    }

    // Extrair IDs dos contatos (formato: 5585999999999@c.us)
    const contatosIds = participantesFiltrados.map((p) => p.id_contato);

    try {
      // Criar grupo
      const groupResult = await this.client.createGroup(tituloGrupo, contatosIds);

      // O retorno pode ser uma string (ID do grupo) ou um objeto CreateGroupResult
      let grupoId: string;
      if (typeof groupResult === 'string') {
        grupoId = groupResult;
      } else {
        grupoId = (groupResult as any).gid?._serialized || (groupResult as any).gid || groupResult;
      }

      // Garantir que o ID está no formato correto (@g.us)
      if (!grupoId.includes('@g.us')) {
        grupoId = `${grupoId}@g.us`;
      }

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
    participantes: Array<{
      id_contato: string;
      [key: string]: any;
    }>,
    filtros: {
      [key: string]: any;
    },
  ): Promise<{
    enviadas: number;
    falhas: number;
    detalhes: Array<{
      contato: string;
      sucesso: boolean;
      erro?: string;
    }>;
  }> {
    if (!this.client || this.status !== WhatsAppStatus.READY) {
      throw new Error('WhatsApp não está conectado. Status: ' + this.status);
    }

    // Filtrar participantes
    const participantesFiltrados = this.filterParticipants(participantes, filtros);

    if (participantesFiltrados.length === 0) {
      throw new Error('Nenhum participante atende aos critérios de filtros especificados');
    }

    const resultados: Array<{
      contato: string;
      sucesso: boolean;
      erro?: string;
    }> = [];

    // Enviar mensagem para cada participante filtrado
    for (const participante of participantesFiltrados) {
      try {
        await this.client.sendMessage(participante.id_contato, mensagem);
        resultados.push({
          contato: participante.id_contato,
          sucesso: true,
        });
      } catch (error: any) {
        resultados.push({
          contato: participante.id_contato,
          sucesso: false,
          erro: error.message || 'Erro desconhecido',
        });
      }
    }

    const enviadas = resultados.filter((r) => r.sucesso).length;
    const falhas = resultados.filter((r) => !r.sucesso).length;

    return {
      enviadas,
      falhas,
      detalhes: resultados,
    };
  }

  async enviarMensagemGrupo(
    grupoId: string,
    mensagem: string,
  ): Promise<{
    sucesso: boolean;
    mensagemId?: string;
    erro?: string;
  }> {
    if (!this.client || this.status !== WhatsAppStatus.READY) {
      throw new Error('WhatsApp não está conectado. Status: ' + this.status);
    }

    try {
      const chatId = grupoId.includes('@g.us') ? grupoId : `${grupoId}@g.us`;
      const result = await this.client.sendMessage(chatId, mensagem);

      return {
        sucesso: true,
        mensagemId: result.id._serialized,
      };
    } catch (error: any) {
      return {
        sucesso: false,
        erro: error.message || 'Erro desconhecido ao enviar mensagem',
      };
    }
  }

  async isReady(): Promise<boolean> {
    return this.status === WhatsAppStatus.READY && this.client !== null;
  }
}
