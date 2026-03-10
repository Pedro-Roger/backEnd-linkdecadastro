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
  ) {}

  @Get('quick-responses')
  listQuickResponses(@Req() req: any) {
    return this.chatService.listQuickResponses(req.user.id);
  }

  @Post('quick-responses')
  createQuickResponse(@Body() data: any, @Req() req: any) {
    return this.chatService.createQuickResponse(req.user.id, data);
  }

  @Put('quick-responses/:id')
  updateQuickResponse(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any,
  ) {
    return this.chatService.updateQuickResponse(id, req.user.id, data);
  }

  @Delete('quick-responses/:id')
  deleteQuickResponse(@Param('id') id: string, @Req() req: any) {
    return this.chatService.deleteQuickResponse(id, req.user.id);
  }
}
