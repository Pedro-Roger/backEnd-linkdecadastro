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
import { Services } from 'src/modules/shared/enum/services.enum';
import { IChatService } from '../services/chat.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import {
  CompanyRoles,
  UserRoles,
} from 'src/modules/shared/utils/decorators/company-role.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
@CompanyRoles(UserRoles.ADMIN, UserRoles.USER, UserRoles.MASTER)
export class ChatQuickResponseController {
  constructor(
    @Inject(Services.CHAT_SERVICE)
    private readonly chatService: IChatService,
  ) {}

  @Get('quick-responses')
  listQuickResponses() {
    return this.chatService.listQuickResponses();
  }

  @Post('quick-responses')
  createQuickResponse(@Body() data: any) {
    return this.chatService.createQuickResponse(data);
  }

  @Put('quick-responses/:id')
  updateQuickResponse(@Param('id') id: string, @Body() data: any) {
    return this.chatService.updateQuickResponse(id, data);
  }

  @Delete('quick-responses/:id')
  deleteQuickResponse(@Param('id') id: string) {
    return this.chatService.deleteQuickResponse(id);
  }
}
