import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async listEvents(@Req() req: any) {
    return this.eventsService.listEvents(req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createEvent(@Req() req: any, @Body() body: any) {
    return this.eventsService.createEvent(req.user.id, req.user.role, body);
  }

  @Get('link/:linkId')
  async getEventByLink(@Param('linkId') linkId: string) {
    return this.eventsService.getEventByLink(linkId);
  }
}


