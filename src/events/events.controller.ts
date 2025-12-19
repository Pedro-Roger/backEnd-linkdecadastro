import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) { }

  @Get()
  async listEvents(@Req() req: any) {
    const userRole = req.user?.role;
    return this.eventsService.listEvents(userRole);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createEvent(@Req() req: any, @Body() body: CreateEventDto) {
    return this.eventsService.createEvent(req.user.id, req.user.role, body);
  }

  @Get('link/:linkId')
  async getEventByLink(@Param('linkId') linkId: string) {
    return this.eventsService.getEventByLink(linkId);
  }

  @Get('slug/:slug')
  async getEventBySlug(@Param('slug') slug: string) {
    return this.eventsService.getEventBySlug(slug);
  }
}


