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
} from '@nestjs/common';
import { Services } from '../chat.constants';
import { ChatService } from '../services/chat.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatQuickResponseController {
  constructor(
    @Inject(Services.CHAT_SERVICE)
    private readonly chatService: ChatService,
  ) { }

  @Get('quick-responses')
  listQuickResponses() {
    return (this.chatService as any).listQuickResponses?.();
  }

  @Post('quick-responses')
  createQuickResponse(@Body() data: any) {
    return (this.chatService as any).createQuickResponse?.(data);
  }

  @Put('quick-responses/:id')
  updateQuickResponse(@Param('id') id: string, @Body() data: any) {
    return (this.chatService as any).updateQuickResponse?.(id, data);
  }

  @Delete('quick-responses/:id')
  deleteQuickResponse(@Param('id') id: string) {
    return (this.chatService as any).deleteQuickResponse?.(id);
  }
}
