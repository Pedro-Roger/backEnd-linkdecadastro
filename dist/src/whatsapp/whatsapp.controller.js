"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppController = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_service_1 = require("./whatsapp.service");
const jwt_guard_1 = require("../auth/jwt.guard");
let WhatsAppController = class WhatsAppController {
    whatsappService;
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }
    async getStatus() {
        try {
            const status = await this.whatsappService.getStatus();
            return {
                success: true,
                ...status,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Erro ao obter status do WhatsApp',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getParticipantes() {
        try {
            const participantes = await this.whatsappService.getParticipants();
            return {
                success: true,
                participantes,
                total: participantes.length,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: 'Erro ao obter participantes',
                error: error.message,
            }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async criarGrupoFiltrado(body) {
        try {
            if (!body.titulo_grupo) {
                throw new common_1.HttpException({
                    success: false,
                    message: 'Título do grupo é obrigatório',
                }, common_1.HttpStatus.BAD_REQUEST);
            }
            if (!body.participantes || !Array.isArray(body.participantes) || body.participantes.length === 0) {
                throw new common_1.HttpException({
                    success: false,
                    message: 'Lista de participantes é obrigatória e não pode estar vazia',
                }, common_1.HttpStatus.BAD_REQUEST);
            }
            if (!body.filtros || typeof body.filtros !== 'object') {
                throw new common_1.HttpException({
                    success: false,
                    message: 'Filtros são obrigatórios e devem ser um objeto',
                }, common_1.HttpStatus.BAD_REQUEST);
            }
            const resultado = await this.whatsappService.criarGrupoFiltrado(body.titulo_grupo, body.participantes, body.filtros);
            return {
                success: true,
                grupo_id: resultado.grupoId,
                participantes_adicionados: resultado.participantesAdicionados,
                total_filtrados: resultado.totalFiltrados,
                total_recebidos: body.participantes.length,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: error.message || 'Erro ao criar grupo filtrado',
            }, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async enviarMensagemSegmentada(body) {
        try {
            if (!body.mensagem || !body.mensagem.trim()) {
                throw new common_1.HttpException({
                    success: false,
                    message: 'Mensagem é obrigatória',
                }, common_1.HttpStatus.BAD_REQUEST);
            }
            if (!body.participantes || !Array.isArray(body.participantes) || body.participantes.length === 0) {
                throw new common_1.HttpException({
                    success: false,
                    message: 'Lista de participantes é obrigatória e não pode estar vazia',
                }, common_1.HttpStatus.BAD_REQUEST);
            }
            if (!body.filtros || typeof body.filtros !== 'object') {
                throw new common_1.HttpException({
                    success: false,
                    message: 'Filtros são obrigatórios e devem ser um objeto',
                }, common_1.HttpStatus.BAD_REQUEST);
            }
            const resultado = await this.whatsappService.enviarMensagemSegmentada(body.mensagem, body.participantes, body.filtros);
            return {
                success: true,
                mensagens_enviadas: resultado.enviadas,
                mensagens_falhadas: resultado.falhas,
                total_filtrados: resultado.enviadas + resultado.falhas,
                total_recebidos: body.participantes.length,
                detalhes: resultado.detalhes,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: error.message || 'Erro ao enviar mensagem segmentada',
            }, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async enviarMensagemGrupo(body) {
        try {
            if (!body.grupo_id || !body.grupo_id.trim()) {
                throw new common_1.HttpException({
                    success: false,
                    message: 'ID do grupo é obrigatório',
                }, common_1.HttpStatus.BAD_REQUEST);
            }
            if (!body.mensagem || !body.mensagem.trim()) {
                throw new common_1.HttpException({
                    success: false,
                    message: 'Mensagem é obrigatória',
                }, common_1.HttpStatus.BAD_REQUEST);
            }
            const resultado = await this.whatsappService.enviarMensagemGrupo(body.grupo_id, body.mensagem);
            if (!resultado.sucesso) {
                throw new common_1.HttpException({
                    success: false,
                    message: resultado.erro || 'Erro ao enviar mensagem para o grupo',
                }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
            return {
                success: true,
                mensagem_id: resultado.mensagemId,
            };
        }
        catch (error) {
            throw new common_1.HttpException({
                success: false,
                message: error.message || 'Erro ao enviar mensagem para o grupo',
            }, error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.WhatsAppController = WhatsAppController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WhatsAppController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('participantes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WhatsAppController.prototype, "getParticipantes", null);
__decorate([
    (0, common_1.Post)('criar-grupo-filtrado'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsAppController.prototype, "criarGrupoFiltrado", null);
__decorate([
    (0, common_1.Post)('enviar-mensagem-segmentada'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsAppController.prototype, "enviarMensagemSegmentada", null);
__decorate([
    (0, common_1.Post)('enviar-mensagem-grupo'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WhatsAppController.prototype, "enviarMensagemGrupo", null);
exports.WhatsAppController = WhatsAppController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('api/whatsapp'),
    __metadata("design:paramtypes", [whatsapp_service_1.WhatsAppService])
], WhatsAppController);
//# sourceMappingURL=whatsapp.controller.js.map