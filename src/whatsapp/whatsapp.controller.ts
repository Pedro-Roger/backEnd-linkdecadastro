import {
  Controller,
  Get,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) { }

  private async getActiveSessionId(req: any, sessionId?: string): Promise<string> {
    if (sessionId) return sessionId;
    const sessions = await this.whatsappService.listUserSessions(req.user.id);
    if (sessions.length === 0) {
      const newSession = await this.whatsappService.createSession(req.user.id, 'Padrão');
      return newSession.id;
    }
    return sessions[0].id;
  }

  @Get('sessions')
  async listSessions(@Req() req: any) {
    try {
      const sessions = await this.whatsappService.listUserSessions(req.user.id);
      return { success: true, sessions };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('sessions')
  async createSession(@Req() req: any, @Body('name') name: string) {
    try {
      const session = await this.whatsappService.createSession(req.user.id, name || 'Novo WhatsApp');
      return { success: true, session };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('status')
  async getStatus(@Req() req: any, @Query('sessionId') sessionId?: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      const status = await this.whatsappService.getStatus(sid);
      return { success: true, sessionId: sid, ...status };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('pair')
  async pairWithPhoneNumber(@Req() req: any, @Body() body: { phoneNumber: string; sessionId?: string }) {
    try {
      const sid = await this.getActiveSessionId(req, body.sessionId);
      const code = await this.whatsappService.requestPairingCode(sid, body.phoneNumber);
      return { success: true, code };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('logout')
  async logout(@Req() req: any, @Query('sessionId') sessionId?: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      await this.whatsappService.logout(sid);
      return { success: true, message: 'WhatsApp desconectado' };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('participantes')
  async getParticipantes() {
    try {
      const participantes = await this.whatsappService.getParticipants();
      return { success: true, participantes, total: participantes.length };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('enviar-mensagem-segmentada')
  async enviarMensagemSegmentada(@Req() req: any, @Body() body: any) {
    try {
      const sid = await this.getActiveSessionId(req, body.sessionId);
      const resultado = await this.whatsappService.enviarMensagemSegmentada(
        sid,
        body.mensagem,
        body.participantes,
        body.filtros,
        body.mediaUrl,
        body.mediaType,
      );
      return { success: true, ...resultado };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('chats')
  async getChats(@Req() req: any, @Query('sessionId') sessionId?: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      const chats = await this.whatsappService.getRecentChats(sid);
      return { success: true, chats };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('messages')
  async getMessages(@Query('sessionId') sessionId: string, @Query('jid') jid: string) {
    try {
      const messages = this.whatsappService.getMessages(sessionId, jid);
      return { success: true, messages };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-message')
  async sendMessage(@Req() req: any, @Body() body: { jid: string; message: string; sessionId?: string }) {
    try {
      const sid = await this.getActiveSessionId(req, body.sessionId);
      const result = await this.whatsappService.enviarMensagemDireta(sid, body.jid, body.message);
      return { ...result };
    } catch (error: any) {
      throw new HttpException({ success: false, message: error.message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('create-group')
  async createGroup(
    @Body() body: { sessionId: string; name: string; participants: string[] },
  ) {
    return this.whatsappService.createGroup(
      body.sessionId,
      body.name,
      body.participants,
    );
  }

  @Get('contact-info')
  async getContactInfo(@Query('phone') phone: string) {
    return this.whatsappService.getContactInfoByPhone(phone);
  }
}
