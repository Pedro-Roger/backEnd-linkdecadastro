import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.notificationsService.listNotifications(
      req.user.id,
      status || null,
      parsedLimit,
    );
  }

  @Patch()
  async update(
    @Req() req: any,
    @Body() body: { notificationId: string; status: string },
  ) {
    return this.notificationsService.updateNotificationStatus(
      req.user.id,
      body.notificationId,
      body.status,
    );
  }
}
