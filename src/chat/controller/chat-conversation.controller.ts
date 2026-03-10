import {
  Controller,
  Get,
  Param,
  Inject,
  UseGuards,
  Query,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { Services } from '../chat.constants';
import { ChatService } from '../services/chat.service';
import {
  ChatConversationsQueryDto,
  PaginationQueryDto,
} from '../dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/jwt.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatConversationController {
  constructor(
    @Inject(Services.CHAT_SERVICE)
    private readonly chatService: ChatService,
  ) {}

  @Get('conversations/:type')
  async getConversations(
    @Param('type') type: string,
    @Query() searchParams: ChatConversationsQueryDto,
    @Req() req: any,
  ) {
    return this.chatService.getConversations(
      type,
      req.user.id,
      req.user.role,
      searchParams,
    );
  }

  @Get('messages/:conversationId')
  getMessages(
    @Param('conversationId') conversationId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.chatService.getMessages(conversationId, pagination);
  }

  @Post('messages/:type/media')
  sendMediaMessage(
    @Param('type') type: string,
    @Body()
    data: {
      phoneNumber: string;
      mediaUrl: string;
      mediaType: 'image' | 'video' | 'audio' | 'document';
      fileName?: string;
      caption?: string;
    },
    @Req() req: any,
  ) {
    return this.chatService.sendMediaMessage(
      type,
      req.user.id,
      data.phoneNumber,
      data.mediaUrl,
      data.mediaType,
      data.fileName,
      data.caption,
      (data as any).mimetype,
      (data as any).channelId,
    );
  }

  @Post('conversations/:conversationId/assign')
  assign(@Param('conversationId') conversationId: string) {
    return (this.chatService as any).assignConversation?.(conversationId);
  }

  @Post('conversations/:conversationId/transfer')
  transfer(
    @Param('conversationId') conversationId: string,
    @Body() body: { targetUserId: string },
  ) {
    return (this.chatService as any).transferConversation?.(
      conversationId,
      body.targetUserId,
    );
  }

  @Post('conversations/:conversationId/read')
  markAsRead(@Param('conversationId') conversationId: string) {
    return (this.chatService as any).markAsRead?.(conversationId);
  }

  @Post('conversations/:conversationId/link-client')
  linkClient(
    @Param('conversationId') conversationId: string,
    @Body() body: { clientId: string },
  ) {
    return (this.chatService as any).linkClient?.(
      conversationId,
      body.clientId,
    );
  }
}
