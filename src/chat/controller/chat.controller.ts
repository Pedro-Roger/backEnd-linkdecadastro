import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Inject,
  Put,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Services } from '../chat.constants';
import { ChatService } from '../services/chat.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatChannelController {
  constructor(
    @Inject(Services.CHAT_SERVICE)
    private readonly chatService: ChatService,
  ) {}

  @Put('channels/:channelId/notification-only')
  updateChannelNotificationOnly(
    @Param('channelId') channelId: string,
    @Body() body: { isNotificationOnly: boolean },
  ) {
    return (this.chatService as any).updateChannelNotificationOnly?.(
      channelId,
      body.isNotificationOnly,
    );
  }

  @Get('channels/:channelId/members')
  getChannelMembers(@Param('channelId') channelId: string) {
    return (this.chatService as any).getChannelMembers?.(channelId);
  }

  @Post('channels/:channelId/members')
  addChannelMember(
    @Param('channelId') channelId: string,
    @Body() body: { userId: string },
  ) {
    return (this.chatService as any).addChannelMember?.(channelId, body.userId);
  }

  @Delete('channels/:channelId/members/:userId')
  removeChannelMember(
    @Param('channelId') channelId: string,
    @Param('userId') userId: string,
  ) {
    return (this.chatService as any).removeChannelMember?.(channelId, userId);
  }

  @Get('channels/:type')
  listChannels(@Param('type') type: string, @Req() req: any) {
    return this.chatService.listChannels(type, req.user.id);
  }

  @Get('channels/:type/:channelId')
  getChannelById(
    @Param('type') type: string,
    @Param('channelId') channelId: string,
    @Req() req: any,
  ) {
    return this.chatService.getChannel(type, req.user.id, channelId);
  }

  @Post('channels/:type')
  createChannel(
    @Param('type') type: string,
    @Body() body: { name?: string },
    @Req() req: any,
  ) {
    return this.chatService.createChannel(type, req.user.id, body?.name);
  }

  @Post('channels/:type/connect')
  connectChannel(
    @Param('type') type: string,
    @Body() body: { channelId?: string },
    @Req() req: any,
  ) {
    return this.chatService.connectChannel(type, req.user.id, body?.channelId);
  }

  @Put('channels/:channelId/name')
  updateChannelName(
    @Param('channelId') channelId: string,
    @Body() body: { name: string },
  ) {
    return (this.chatService as any).updateChannelName?.(channelId, body.name);
  }

  @Delete('channels/:channelId/disconnect')
  disconnectChannel(@Param('channelId') channelId: string) {
    return this.chatService.disconnectByChannelId(channelId);
  }

  @Get('channel/:type')
  getChannel(@Param('type') type: string, @Req() req: any) {
    return this.chatService.getChannel(type, req.user.id);
  }

  @Post('connect/:type')
  connect(
    @Param('type') type: string,
    @Body() body: { channelId?: string },
    @Req() req: any,
  ) {
    return this.chatService.connectChannel(type, req.user.id, body?.channelId);
  }

  @Get('status/:type')
  getStatus(
    @Param('type') type: string,
    @Req() req: any,
    @Query('channelId') channelId?: string,
  ) {
    return this.chatService.getStatus(type, req.user.id, channelId);
  }

  @Delete('disconnect/:type')
  disconnect(
    @Param('type') type: string,
    @Query('channelId') channelId?: string,
  ) {
    return this.chatService.disconnect(type, channelId);
  }

  @Post('test-message/:type')
  sendTest(
    @Param('type') type: string,
    @Body() body: { phoneNumber: string; message: string; channelId?: string },
  ) {
    return (this.chatService as any).sendTestMessage?.(
      type,
      body.phoneNumber,
      body.message,
      body.channelId,
    );
  }

  @Post('send-message/:type')
  sendMessage(
    @Param('type') type: string,
    @Body() body: { phoneNumber: string; message: string; channelId?: string },
    @Req() req: any,
  ) {
    return this.chatService.sendMessage(
      type,
      req.user.id,
      body.phoneNumber,
      body.message,
      body.channelId,
    );
  }
}
