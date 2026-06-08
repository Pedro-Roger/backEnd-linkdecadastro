import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EventCityService } from './event-city.service';
import { UpdateCityStatusDto } from './dto/update-city-status.dto';
import { UpsertCityDto } from './dto/upsert-city.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin/events/:eventId/cities')
export class EventCityAdminController {
  constructor(private readonly service: EventCityService) {}

  @Get()
  listFull(@Param('eventId') eventId: string) {
    return this.service.listFull(eventId);
  }

  @Post()
  upsert(@Param('eventId') eventId: string, @Body() dto: UpsertCityDto) {
    return this.service.upsertCity(eventId, dto);
  }

  @Patch(':limitId/status')
  updateStatus(
    @Param('limitId') limitId: string,
    @Body() dto: UpdateCityStatusDto,
  ) {
    return this.service.updateStatus(limitId, dto);
  }
}
