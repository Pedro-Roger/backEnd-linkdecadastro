import {
  Controller,
  Get,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

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

@UseGuards(JwtAuthGuard)
@Controller('api/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) { }

  @Get('status')
  async getStatus() {
    try {
      const status = await this.whatsappService.getStatus();
      return {
        success: true,
        ...status,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Erro ao obter status do WhatsApp',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('pair')
  async pairWithPhoneNumber(@Body() body: { phoneNumber: string }) {
    try {
      if (!body.phoneNumber) {
        throw new HttpException(
          { success: false, message: 'Número de telefone é obrigatório' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const code = await this.whatsappService.requestPairingCode(body.phoneNumber);
      return { success: true, code };
    } catch (error: any) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('participantes')
  async getParticipantes() {
    try {
      const participantes = await this.whatsappService.getParticipants();
      return {
        success: true,
        participantes,
        total: participantes.length,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Erro ao obter participantes',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('criar-grupo-filtrado')
  async criarGrupoFiltrado(@Body() body: CriarGrupoFiltradoDto) {
    try {
      if (!body.titulo_grupo) {
        throw new HttpException(
          {
            success: false,
            message: 'Título do grupo é obrigatório',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.participantes || !Array.isArray(body.participantes) || body.participantes.length === 0) {
        throw new HttpException(
          {
            success: false,
            message: 'Lista de participantes é obrigatória e não pode estar vazia',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.filtros || typeof body.filtros !== 'object') {
        throw new HttpException(
          {
            success: false,
            message: 'Filtros são obrigatórios e devem ser um objeto',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const resultado = await this.whatsappService.criarGrupoFiltrado(
        body.titulo_grupo,
        body.participantes,
        body.filtros,
      );

      return {
        success: true,
        grupo_id: resultado.grupoId,
        participantes_adicionados: resultado.participantesAdicionados,
        total_filtrados: resultado.totalFiltrados,
        total_recebidos: body.participantes.length,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Erro ao criar grupo filtrado',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('enviar-mensagem-segmentada')
  async enviarMensagemSegmentada(@Body() body: EnviarMensagemSegmentadaDto) {
    try {
      if (!body.mensagem || !body.mensagem.trim()) {
        throw new HttpException(
          {
            success: false,
            message: 'Mensagem é obrigatória',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.participantes || !Array.isArray(body.participantes) || body.participantes.length === 0) {
        throw new HttpException(
          {
            success: false,
            message: 'Lista de participantes é obrigatória e não pode estar vazia',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.filtros || typeof body.filtros !== 'object') {
        throw new HttpException(
          {
            success: false,
            message: 'Filtros são obrigatórios e devem ser um objeto',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const resultado = await this.whatsappService.enviarMensagemSegmentada(
        body.mensagem,
        body.participantes,
        body.filtros,
      );

      return {
        success: true,
        mensagens_enviadas: resultado.enviadas,
        mensagens_falhadas: resultado.falhas,
        total_filtrados: resultado.enviadas + resultado.falhas,
        total_recebidos: body.participantes.length,
        detalhes: resultado.detalhes,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Erro ao enviar mensagem segmentada',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('enviar-mensagem-grupo')
  async enviarMensagemGrupo(@Body() body: EnviarMensagemGrupoDto) {
    try {
      if (!body.grupo_id || !body.grupo_id.trim()) {
        throw new HttpException(
          {
            success: false,
            message: 'ID do grupo é obrigatório',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.mensagem || !body.mensagem.trim()) {
        throw new HttpException(
          {
            success: false,
            message: 'Mensagem é obrigatória',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const resultado = await this.whatsappService.enviarMensagemGrupo(
        body.grupo_id,
        body.mensagem,
      );

      if (!resultado.sucesso) {
        throw new HttpException(
          {
            success: false,
            message: resultado.erro || 'Erro ao enviar mensagem para o grupo',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        mensagem_id: resultado.mensagemId,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Erro ao enviar mensagem para o grupo',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
