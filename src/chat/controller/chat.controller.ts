import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Inject,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Services } from 'src/modules/shared/enum/services.enum';
import { IChatService } from '../services/chat.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import {
  CompanyRoles,
  UserRoles,
} from 'src/modules/shared/utils/decorators/company-role.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
@CompanyRoles(UserRoles.ADMIN, UserRoles.MASTER)
export class ChatChannelController {
  constructor(
    @Inject(Services.CHAT_SERVICE)
    private readonly chatService: IChatService,
  ) { }

  @Put('channels/:channelId/notification-only')
  updateChannelNotificationOnly(
    @Param('channelId') channelId: string,
    @Body() body: { isNotificationOnly: boolean },
  ) {
    return this.chatService.updateChannelNotificationOnly(channelId, body.isNotificationOnly);
  }

  @Get('channels/:channelId/members')
  getChannelMembers(@Param('channelId') channelId: string) {
    return this.chatService.getChannelMembers(channelId);
  }

  @Post('channels/:channelId/members')
  addChannelMember(
    @Param('channelId') channelId: string,
    @Body() body: { userId: string },
  ) {
    return this.chatService.addChannelMember(channelId, body.userId);
  }

  @Delete('channels/:channelId/members/:userId')
  removeChannelMember(
    @Param('channelId') channelId: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.removeChannelMember(channelId, userId);
  }

  @Get('channels/:type')
  listChannels(@Param('type') type: string) {
    return this.chatService.listChannels(type);
  }

  @Get('channels/:type/:channelId')
  getChannelById(
    @Param('type') type: string,
    @Param('channelId') channelId: string,
  ) {
    return this.chatService.getChannel(type, channelId);
  }

  @Post('channels/:type')
  createChannel(@Param('type') type: string, @Body() body: { name?: string }) {
    return this.chatService.createChannel(type, body?.name);
  }

  @Post('channels/:type/connect')
  connectChannel(
    @Param('type') type: string,
    @Body() body: { channelId?: string },
  ) {
    return this.chatService.connectChannel(type, body?.channelId);
  }

  @Put('channels/:channelId/name')
  updateChannelName(
    @Param('channelId') channelId: string,
    @Body() body: { name: string },
  ) {
    return this.chatService.updateChannelName(channelId, body.name);
  }

  @Delete('channels/:channelId/disconnect')
  disconnectChannel(@Param('channelId') channelId: string) {
    return this.chatService.disconnectByChannelId(channelId);
  }

  @Get('channel/:type')
  getChannel(@Param('type') type: string) {
    return this.chatService.getChannel(type);
  }

  @Post('connect/:type')
  connect(@Param('type') type: string, @Body() body: { channelId?: string }) {
    return this.chatService.connectChannel(type, body?.channelId);
  }

  @Get('status/:type')
  getStatus(
    @Param('type') type: string,
    @Query('channelId') channelId?: string,
  ) {
    return this.chatService.getStatus(type, channelId);
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
    return this.chatService.sendTestMessage(
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
  ) {
    return this.chatService.sendMessage(
      type,
      body.phoneNumber,
      body.message,
      body.channelId,
    );
  }
}
