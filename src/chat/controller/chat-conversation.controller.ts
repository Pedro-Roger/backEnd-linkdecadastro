import {
  Controller,
  Get,
  Param,
  Inject,
  UseGuards,
  Query,
  Post,
  Body,
  Patch,
} from '@nestjs/common';
import { Services } from 'src/modules/shared/enum/services.enum';
import { IChatService } from '../services/chat.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import {
  CompanyRoles,
  UserRoles,
} from 'src/modules/shared/utils/decorators/company-role.decorator';
import {
  ChatConversationsQueryDto,
  PaginationQueryDto,
} from 'src/modules/shared/dto/pagination-query.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
@CompanyRoles(UserRoles.ADMIN, UserRoles.USER, UserRoles.MASTER)
export class ChatConversationController {
  constructor(
    @Inject(Services.CHAT_SERVICE)
    private readonly chatService: IChatService,
  ) { }

  @Get('conversations/:type')
  async getConversations(
    @Param('type') type: string,
    @Query() searchParams: ChatConversationsQueryDto,
  ) {
    return this.chatService.getConversations(type, searchParams);
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
  ) {
    return this.chatService.sendMediaMessage(
      type,
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
    return this.chatService.assignConversation(conversationId);
  }

  @Post('conversations/:conversationId/transfer')
  transfer(
    @Param('conversationId') conversationId: string,
    @Body() body: { targetUserId: string },
  ) {
    return this.chatService.transferConversation(
      conversationId,
      body.targetUserId,
    );
  }

  @Post('conversations/:conversationId/read')
  markAsRead(@Param('conversationId') conversationId: string) {
    return this.chatService.markAsRead(conversationId);
  }

  @Post('conversations/:conversationId/link-client')
  linkClient(
    @Param('conversationId') conversationId: string,
    @Body() body: { clientId: string },
  ) {
    return this.chatService.linkClient(conversationId, body.clientId);
  }
}
