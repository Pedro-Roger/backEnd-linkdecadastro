"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = exports.WhatsAppStatus = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const whatsapp_web_js_1 = require("whatsapp-web.js");
const QRCode = __importStar(require("qrcode"));
const qrcodeTerminal = __importStar(require("qrcode-terminal"));
const path_1 = require("path");
const fs_1 = require("fs");
var WhatsAppStatus;
(function (WhatsAppStatus) {
    WhatsAppStatus["DISCONNECTED"] = "DISCONNECTED";
    WhatsAppStatus["CONNECTING"] = "CONNECTING";
    WhatsAppStatus["QR_CODE"] = "QR_CODE";
    WhatsAppStatus["AUTHENTICATED"] = "AUTHENTICATED";
    WhatsAppStatus["READY"] = "READY";
    WhatsAppStatus["AUTH_FAILURE"] = "AUTH_FAILURE";
})(WhatsAppStatus || (exports.WhatsAppStatus = WhatsAppStatus = {}));
let WhatsAppService = class WhatsAppService {
    prisma;
    client = null;
    status = WhatsAppStatus.DISCONNECTED;
    qrCodeData = null;
    sessionPath;
    constructor(prisma) {
        this.prisma = prisma;
        this.sessionPath = (0, path_1.join)(process.cwd(), '.wwebjs_auth');
        if (!(0, fs_1.existsSync)(this.sessionPath)) {
            (0, fs_1.mkdirSync)(this.sessionPath, { recursive: true });
        }
    }
    async onModuleInit() {
        console.log('🚀 [WhatsApp] Iniciando serviço WhatsApp...');
        this.initializeClient().catch((error) => {
            console.error('❌ [WhatsApp] Erro ao inicializar WhatsApp (não crítico):', error);
        });
    }
    async onModuleDestroy() {
        if (this.client) {
            await this.client.destroy();
        }
    }
    async initializeClient() {
        if (this.client) {
            return;
        }
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
            const puppeteerOptions = {
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
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                if ((0, fs_1.existsSync)(process.env.PUPPETEER_EXECUTABLE_PATH)) {
                    puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
                    console.log(`🔧 [WhatsApp] Usando Chrome customizado em: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
                }
                else {
                    console.log(`⚠️  [WhatsApp] Caminho do Chrome especificado não encontrado: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
                    console.log('📦 [WhatsApp] Usando Chrome do Puppeteer (será baixado automaticamente se necessário)');
                }
            }
            else {
                console.log('📦 [WhatsApp] Usando Chrome do Puppeteer (será baixado automaticamente se necessário)');
            }
            this.client = new whatsapp_web_js_1.Client({
                authStrategy: new whatsapp_web_js_1.LocalAuth({
                    dataPath: this.sessionPath,
                }),
                puppeteer: puppeteerOptions,
            });
            this.client.on('qr', async (qr) => {
                this.status = WhatsAppStatus.QR_CODE;
                console.log('\n📱 [WhatsApp] QR Code gerado! Escaneie com seu WhatsApp:');
                console.log('═══════════════════════════════════════════════════════════');
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
                }
                catch (error) {
                    console.error('❌ [WhatsApp] Erro ao gerar QR Code em base64:', error);
                }
            });
            this.client.on('authenticated', () => {
                console.log('✅ [WhatsApp] Autenticado com sucesso!');
                this.status = WhatsAppStatus.AUTHENTICATED;
                this.qrCodeData = null;
            });
            this.client.on('auth_failure', (msg) => {
                console.error('❌ [WhatsApp] Falha na autenticação:', msg);
                this.status = WhatsAppStatus.AUTH_FAILURE;
                this.qrCodeData = null;
            });
            this.client.on('ready', () => {
                console.log('✅ [WhatsApp] Cliente WhatsApp está pronto e conectado!');
                this.status = WhatsAppStatus.READY;
                this.qrCodeData = null;
            });
            this.client.on('disconnected', (reason) => {
                console.log('⚠️  [WhatsApp] Cliente desconectado:', reason);
                this.status = WhatsAppStatus.DISCONNECTED;
                this.client = null;
            });
            this.client.on('loading_screen', (percent, message) => {
                console.log(`⏳ [WhatsApp] Carregando: ${percent}% - ${message}`);
            });
            console.log('🔄 [WhatsApp] Inicializando cliente...');
            this.client.initialize().catch((error) => {
                console.error('❌ [WhatsApp] Erro ao inicializar cliente:', error);
                this.status = WhatsAppStatus.DISCONNECTED;
            });
        }
        catch (error) {
            console.error('❌ [WhatsApp] Erro ao criar cliente:', error);
            this.status = WhatsAppStatus.DISCONNECTED;
        }
    }
    async getStatus() {
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
    filterParticipants(participants, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return participants;
        }
        return participants.filter((participant) => {
            return Object.keys(filters).every((key) => {
                const filterValue = filters[key];
                const participantValue = participant[key];
                return participantValue === filterValue;
            });
        });
    }
    async criarGrupoFiltrado(tituloGrupo, participantes, filtros) {
        if (!this.client || this.status !== WhatsAppStatus.READY) {
            throw new Error('WhatsApp não está conectado. Status: ' + this.status);
        }
        const participantesFiltrados = this.filterParticipants(participantes, filtros);
        if (participantesFiltrados.length === 0) {
            throw new Error('Nenhum participante atende aos critérios de filtros especificados');
        }
        const contatosIds = participantesFiltrados.map((p) => p.id_contato);
        try {
            const groupResult = await this.client.createGroup(tituloGrupo, contatosIds);
            let grupoId;
            if (typeof groupResult === 'string') {
                grupoId = groupResult;
            }
            else {
                grupoId = groupResult.gid?._serialized || groupResult.gid || groupResult;
            }
            if (!grupoId.includes('@g.us')) {
                grupoId = `${grupoId}@g.us`;
            }
            return {
                grupoId,
                participantesAdicionados: contatosIds,
                totalFiltrados: participantesFiltrados.length,
            };
        }
        catch (error) {
            throw new Error(`Erro ao criar grupo: ${error.message}`);
        }
    }
    async enviarMensagemSegmentada(mensagem, participantes, filtros) {
        if (!this.client || this.status !== WhatsAppStatus.READY) {
            throw new Error('WhatsApp não está conectado. Status: ' + this.status);
        }
        const participantesFiltrados = this.filterParticipants(participantes, filtros);
        if (participantesFiltrados.length === 0) {
            throw new Error('Nenhum participante atende aos critérios de filtros especificados');
        }
        const resultados = [];
        for (const participante of participantesFiltrados) {
            try {
                let mensagemPersonalizada = mensagem;
                if (participante.nome) {
                    mensagemPersonalizada = mensagemPersonalizada.replace(/{nome}/g, participante.nome);
                }
                else {
                    mensagemPersonalizada = mensagemPersonalizada.replace(/{nome}/g, '');
                    mensagemPersonalizada = mensagemPersonalizada.replace(/Olá, !/g, 'Olá!');
                    mensagemPersonalizada = mensagemPersonalizada.replace(/Olá, /g, 'Olá! ');
                }
                await this.client.sendMessage(participante.id_contato, mensagemPersonalizada);
                resultados.push({
                    contato: participante.id_contato,
                    sucesso: true,
                });
            }
            catch (error) {
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
    async enviarMensagemGrupo(grupoId, mensagem) {
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
        }
        catch (error) {
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
            .filter((user) => user.phone && user.phone.length >= 10)
            .map((user) => {
            let phone = user.phone.replace(/\D/g, '');
            if (phone.length <= 11) {
                phone = '55' + phone;
            }
            return {
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
    async isReady() {
        return this.status === WhatsAppStatus.READY && this.client !== null;
    }
};
exports.WhatsAppService = WhatsAppService;
exports.WhatsAppService = WhatsAppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WhatsAppService);
//# sourceMappingURL=whatsapp.service.js.map