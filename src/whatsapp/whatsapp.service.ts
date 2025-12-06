import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import * as qrcodeTerminal from 'qrcode-terminal';
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

  constructor(private readonly prisma: PrismaService) {
    // Criar diretório para sessões se não existir
    this.sessionPath = join(process.cwd(), '.wwebjs_auth');
    if (!existsSync(this.sessionPath)) {
      mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  async onModuleInit() {
    console.log('🚀 [WhatsApp] Iniciando serviço WhatsApp...');
    // Inicializar de forma assíncrona sem bloquear o servidor
    this.initializeClient().catch((error) => {
      console.error('❌ [WhatsApp] Erro ao inicializar WhatsApp (não crítico):', error);
      // Não lançar erro para não bloquear o servidor
    });
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

    // Verificar se estamos em ambiente de produção (Render, etc) e pular inicialização automática
    const isProduction = process.env.NODE_ENV === 'production';
    const skipAutoInit = process.env.WHATSAPP_SKIP_AUTO_INIT === 'true';

    if (isProduction && skipAutoInit) {
      console.log('⚠️  [WhatsApp] Inicialização automática desabilitada. Use o endpoint /api/whatsapp/status para inicializar manualmente.');
      this.status = WhatsAppStatus.DISCONNECTED;
      return;
    }

    try {
      console.log('📱 [WhatsApp] Criando cliente WhatsApp...');
      this.status = WhatsAppStatus.CONNECTING;

      // Configuração otimizada para Render e outros ambientes serverless
      const puppeteerOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--single-process',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-extensions',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-notifications',
          '--disable-offer-store-unmasked-wallet-cards',
          '--disable-popup-blocking',
          '--disable-print-preview',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-setuid-sandbox',
          '--disable-speech-api',
          '--disable-sync',
          '--disable-translate',
          '--disable-windows10-custom-titlebar',
          '--hide-scrollbars',
          '--ignore-gpu-blacklist',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-pings',
          '--no-sandbox',
          '--password-store=basic',
          '--use-gl=swiftshader',
          '--use-mock-keychain',
        ],
      };

      // Tentar usar executável do Chrome do sistema apenas se especificado via variável de ambiente
      // Caso contrário, deixar o Puppeteer usar o Chrome que vem com ele ou baixar automaticamente
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        if (existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
          puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
          console.log(`🔧 [WhatsApp] Usando Chrome customizado em: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        } else {
          console.log(`⚠️  [WhatsApp] Caminho do Chrome especificado não encontrado: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
          console.log('📦 [WhatsApp] Usando Chrome do Puppeteer (será baixado automaticamente se necessário)');
        }
      } else {
        // Não definir executablePath, deixar Puppeteer usar o Chrome que vem com ele ou baixar
        console.log('📦 [WhatsApp] Usando Chrome do Puppeteer (será baixado automaticamente se necessário)');
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: this.sessionPath,
        }),
        puppeteer: puppeteerOptions,
      });

      // Evento de QR Code
      this.client.on('qr', async (qr) => {
        this.status = WhatsAppStatus.QR_CODE;
        console.log('\n📱 [WhatsApp] QR Code gerado! Escaneie com seu WhatsApp:');
        console.log('═══════════════════════════════════════════════════════════');

        // Exibir QR Code no terminal
        qrcodeTerminal.generate(qr, { small: true });

        console.log('═══════════════════════════════════════════════════════════');
        console.log('💡 Abra o WhatsApp no seu celular e vá em:');
        console.log('   Configurações > Aparelhos conectados > Conectar um aparelho');
        console.log('   Escaneie o QR Code acima\n');

        try {
          const base64 = await QRCode.toDataURL(qr);
          this.qrCodeData = {
            qr,
            base64,
          };
        } catch (error) {
          console.error('❌ [WhatsApp] Erro ao gerar QR Code em base64:', error);
        }
      });

      // Evento de autenticação
      this.client.on('authenticated', () => {
        console.log('✅ [WhatsApp] Autenticado com sucesso!');
        this.status = WhatsAppStatus.AUTHENTICATED;
        this.qrCodeData = null;
      });

      // Evento de autenticação falhada
      this.client.on('auth_failure', (msg) => {
        console.error('❌ [WhatsApp] Falha na autenticação:', msg);
        this.status = WhatsAppStatus.AUTH_FAILURE;
        this.qrCodeData = null;
      });

      // Evento de ready
      this.client.on('ready', () => {
        console.log('✅ [WhatsApp] Cliente WhatsApp está pronto e conectado!');
        this.status = WhatsAppStatus.READY;
        this.qrCodeData = null;
      });

      // Evento de desconexão
      this.client.on('disconnected', (reason) => {
        console.log('⚠️  [WhatsApp] Cliente desconectado:', reason);
        this.status = WhatsAppStatus.DISCONNECTED;
        this.client = null;
      });

      // Evento de loading screen
      this.client.on('loading_screen', (percent, message) => {
        console.log(`⏳ [WhatsApp] Carregando: ${percent}% - ${message}`);
      });

      // Inicializar cliente (não aguardar para não bloquear)
      console.log('🔄 [WhatsApp] Inicializando cliente...');
      this.client.initialize().catch((error) => {
        console.error('❌ [WhatsApp] Erro ao inicializar cliente:', error);
        this.status = WhatsAppStatus.DISCONNECTED;
      });
    } catch (error) {
      console.error('❌ [WhatsApp] Erro ao criar cliente:', error);
      this.status = WhatsAppStatus.DISCONNECTED;
      // Não lançar erro para não bloquear o servidor
    }
  }

  async getStatus(): Promise<{
    status: WhatsAppStatus;
    qrCode?: string;
    qrCodeBase64?: string;
  }> {
    // Se não há cliente e não está em modo de pular auto-init, inicializar
    if (!this.client) {
      const isProduction = process.env.NODE_ENV === 'production';
      const skipAutoInit = process.env.WHATSAPP_SKIP_AUTO_INIT === 'true';

      if (!(isProduction && skipAutoInit)) {
        await this.initializeClient();
      }
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
  ): Array<{ id_contato: string;[key: string]: any }> {
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
      nome?: string;
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

    // Enviar mensagem personalizada para cada participante filtrado
    for (const participante of participantesFiltrados) {
      try {
        // Personalizar mensagem com o nome do participante
        let mensagemPersonalizada = mensagem;

        // Substituir {nome} pelo nome do participante
        if (participante.nome) {
          mensagemPersonalizada = mensagemPersonalizada.replace(/{nome}/g, participante.nome);
        } else {
          // Se não tiver nome, usar uma saudação genérica
          mensagemPersonalizada = mensagemPersonalizada.replace(/{nome}/g, '');
          mensagemPersonalizada = mensagemPersonalizada.replace(/Olá, !/g, 'Olá!');
          mensagemPersonalizada = mensagemPersonalizada.replace(/Olá, /g, 'Olá! ');
        }

        await this.client.sendMessage(participante.id_contato, mensagemPersonalizada);
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

  async getParticipants() {
    const users = await this.prisma.user.findMany({
      where: {
        phone: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        participantType: true,
        state: true,
        city: true,
      },
    });

    return users
      .filter((user) => user.phone && user.phone.length >= 10) // Filtro básico de telefone
      .map((user) => {
        // Formatar telefone para padrão WhatsApp (apenas números)
        let phone = user.phone!.replace(/\D/g, '');

        // Remover zero à esquerda se houver (ex: 011999999999 -> 11999999999)
        if (phone.startsWith('0') && phone.length > 11) {
          phone = phone.substring(1);
        }

        // Adicionar 55 se não tiver (assumindo Brasil)
        // DDD (2) + Número (8 ou 9) = 10 ou 11 dígitos
        if (phone.length >= 10 && phone.length <= 11) {
          phone = '55' + phone;
        }

        return {
          id: user.id,
          id_contato: `${phone}@c.us`,
          nome: user.name,
          email: user.email,
          role: user.role,
          tipo: user.participantType,
          estado: user.state,
          cidade: user.city,
        };
      });
  }

  async isReady(): Promise<boolean> {
    return this.status === WhatsAppStatus.READY && this.client !== null;
  }
}
