import { WhatsAppService } from './whatsapp.service';
interface CriarGrupoFiltradoDto {
    titulo_grupo: string;
    participantes: Array<{
        id_contato: string;
        [key: string]: any;
    }>;
    filtros: {
        [key: string]: any;
    };
}
interface EnviarMensagemSegmentadaDto {
    mensagem: string;
    participantes: Array<{
        id_contato: string;
        [key: string]: any;
    }>;
    filtros: {
        [key: string]: any;
    };
}
interface EnviarMensagemGrupoDto {
    grupo_id: string;
    mensagem: string;
}
export declare class WhatsAppController {
    private readonly whatsappService;
    constructor(whatsappService: WhatsAppService);
    getStatus(): Promise<{
        status: import("./whatsapp.service").WhatsAppStatus;
        qrCode?: string;
        qrCodeBase64?: string;
        success: boolean;
    }>;
    getParticipantes(): Promise<{
        success: boolean;
        participantes: {
            id: string;
            id_contato: string;
            nome: string;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
            tipo: import("@prisma/client").$Enums.ParticipantType | null;
            estado: string | null;
            cidade: string | null;
        }[];
        total: number;
    }>;
    criarGrupoFiltrado(body: CriarGrupoFiltradoDto): Promise<{
        success: boolean;
        grupo_id: string;
        participantes_adicionados: string[];
        total_filtrados: number;
        total_recebidos: number;
    }>;
    enviarMensagemSegmentada(body: EnviarMensagemSegmentadaDto): Promise<{
        success: boolean;
        mensagens_enviadas: number;
        mensagens_falhadas: number;
        total_filtrados: number;
        total_recebidos: number;
        detalhes: {
            contato: string;
            sucesso: boolean;
            erro?: string;
        }[];
    }>;
    enviarMensagemGrupo(body: EnviarMensagemGrupoDto): Promise<{
        success: boolean;
        mensagem_id: string | undefined;
    }>;
}
export {};
