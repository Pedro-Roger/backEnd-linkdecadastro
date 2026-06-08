import { Controller, Get, Param } from '@nestjs/common';
import { EventCityService } from './event-city.service';

@Controller('events/:eventId/cities')
export class EventCityPublicController {
  constructor(private readonly service: EventCityService) {}

  @Get()
  list(@Param('eventId') eventId: string) {
    return this.service.listAvailable(eventId);
  }
}
