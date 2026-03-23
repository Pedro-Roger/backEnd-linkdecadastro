import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WhatsAppService } from './whatsapp.service';

@UseGuards(JwtAuthGuard)
@Controller('api/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) { }

  private debug(label: string, payload: Record<string, any>) {
    console.log(`[WhatsApp Debug] ${label}`, payload);
  }

  private rethrow(error: any, fallbackStatus = HttpStatus.INTERNAL_SERVER_ERROR): never {
    if (error instanceof HttpException) {
      throw error;
    }

    throw new HttpException(
      { success: false, message: error?.message || 'Erro interno no WhatsApp.' },
      fallbackStatus,
    );
  }

  private async getActiveSessionId(req: any, sessionId?: string): Promise<string> {
    if (sessionId) {
      const hasAccess = await this.whatsappService.userHasAccessToSession(
        req.user.id,
        sessionId,
      );

      this.debug('getActiveSessionId', {
        userId: req.user?.id,
        userEmail: req.user?.email,
        sessionId,
        userHasAccessToSession: hasAccess,
      });

      if (!hasAccess) {
        throw new ForbiddenException('Voce nao tem acesso a esta sessao de WhatsApp.');
      }

      return sessionId;
    }

    const sessions = await this.whatsappService.listUserSessions(req.user.id);
    if (sessions.length === 0) {
      const newSession = await this.whatsappService.createSession(req.user.id, 'Padrao');
      return newSession.id;
    }

    return sessions[0].id;
  }

  @Get('sessions')
  async listSessions(@Req() req: any) {
    try {
      const sessions = await this.whatsappService.listUserSessions(req.user.id);
      this.debug('listSessions', {
        userId: req.user?.id,
        userEmail: req.user?.email,
        count: sessions.length,
        sessionIds: sessions.map((session) => session.id),
      });
      return { success: true, sessions };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Post('sessions')
  async createSession(@Req() req: any, @Body('name') name: string) {
    try {
      const session = await this.whatsappService.createSession(req.user.id, name || 'Novo WhatsApp');
      this.debug('createSession', {
        userId: req.user?.id,
        userEmail: req.user?.email,
        createdSessionId: session.id,
        createdSessionName: session.instance_name,
      });
      return { success: true, session };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Get('status')
  async getStatus(@Req() req: any, @Query('sessionId') sessionId?: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      const status = await this.whatsappService.getStatus(sid);
      return { success: true, sessionId: sid, ...status };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Post('pair')
  async pairWithPhoneNumber(@Req() req: any, @Body() body: { phoneNumber: string; sessionId?: string }) {
    try {
      const sid = await this.getActiveSessionId(req, body.sessionId);
      const code = await this.whatsappService.requestPairingCode(sid, body.phoneNumber);
      return { success: true, code };
    } catch (error: any) {
      this.rethrow(error, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('logout')
  async logout(@Req() req: any, @Query('sessionId') sessionId?: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      await this.whatsappService.logout(sid);
      return { success: true, message: 'WhatsApp desconectado' };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Post('reconnect')
  async reconnect(@Req() req: any, @Body() body: { sessionId?: string }) {
    try {
      const sid = await this.getActiveSessionId(req, body.sessionId);
      const status = await this.whatsappService.reconnect(sid);
      return { success: true, sessionId: sid, ...status };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Delete('sessions/:sessionId')
  async deleteSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      await this.whatsappService.deleteSession(sid);
      return { success: true, message: 'Conta de WhatsApp removida com sucesso.' };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Get('participantes')
  async getParticipantes() {
    try {
      const participantes = await this.whatsappService.getParticipants();
      return { success: true, participantes, total: participantes.length };
    } catch (error: any) {
      this.rethrow(error);
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
      this.rethrow(error);
    }
  }

  @Get('chats')
  async getChats(@Req() req: any, @Query('sessionId') sessionId?: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      const chats = await this.whatsappService.getRecentChats(sid);
      return { success: true, chats };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Get('messages')
  async getMessages(@Req() req: any, @Query('sessionId') sessionId: string, @Query('jid') jid: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      const messages = await this.whatsappService.getMessages(sid, jid);
      return { success: true, messages };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Post('send-message')
  async sendMessage(@Req() req: any, @Body() body: { jid: string; message: string; sessionId?: string }) {
    try {
      const sid = await this.getActiveSessionId(req, body.sessionId);
      const result = await this.whatsappService.enviarMensagemDireta(sid, body.jid, body.message);
      return { ...result };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Post('create-group')
  async createGroup(@Body() body: { sessionId: string; name: string; participants: string[] }) {
    return this.whatsappService.createGroup(
      body.sessionId,
      body.name,
      body.participants,
    );
  }

  @Post('add-to-group')
  async addToGroup(
    @Req() req: any,
    @Body() body: { sessionId?: string; groupId: string; participants: string[] },
  ) {
    try {
      const sid = await this.getActiveSessionId(req, body.sessionId);
      return this.whatsappService.addParticipantsToGroup(
        sid,
        body.groupId,
        body.participants,
      );
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Get('groups')
  async getGroups(@Req() req: any, @Query('sessionId') sessionId?: string) {
    try {
      const sid = await this.getActiveSessionId(req, sessionId);
      const groups = await this.whatsappService.getGroups(sid);
      return { success: true, groups };
    } catch (error: any) {
      this.rethrow(error);
    }
  }

  @Get('contact-info')
  async getContactInfo(@Query('phone') phone: string) {
    return this.whatsappService.getContactInfoByPhone(phone);
  }
}
