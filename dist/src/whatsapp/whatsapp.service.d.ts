import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare enum WhatsAppStatus {
    DISCONNECTED = "DISCONNECTED",
    CONNECTING = "CONNECTING",
    QR_CODE = "QR_CODE",
    AUTHENTICATED = "AUTHENTICATED",
    READY = "READY",
    AUTH_FAILURE = "AUTH_FAILURE"
}
export declare class WhatsAppService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private client;
    private status;
    private qrCodeData;
    private sessionPath;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private initializeClient;
    getStatus(): Promise<{
        status: WhatsAppStatus;
        qrCode?: string;
        qrCodeBase64?: string;
    }>;
    private filterParticipants;
    criarGrupoFiltrado(tituloGrupo: string, participantes: Array<{
        id_contato: string;
        [key: string]: any;
    }>, filtros: {
        [key: string]: any;
    }): Promise<{
        grupoId: string;
        participantesAdicionados: string[];
        totalFiltrados: number;
    }>;
    enviarMensagemSegmentada(mensagem: string, participantes: Array<{
        id_contato: string;
        nome?: string;
        [key: string]: any;
    }>, filtros: {
        [key: string]: any;
    }): Promise<{
        enviadas: number;
        falhas: number;
        detalhes: Array<{
            contato: string;
            sucesso: boolean;
            erro?: string;
        }>;
    }>;
    enviarMensagemGrupo(grupoId: string, mensagem: string): Promise<{
        sucesso: boolean;
        mensagemId?: string;
        erro?: string;
    }>;
    getParticipants(): Promise<{
        id: string;
        id_contato: string;
        nome: string;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        tipo: import("@prisma/client").$Enums.ParticipantType | null;
        estado: string | null;
        cidade: string | null;
    }[]>;
    isReady(): Promise<boolean>;
}
