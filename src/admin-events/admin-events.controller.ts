import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AdminEventsService } from './admin-events.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly adminEventsService: AdminEventsService) {}

  @Patch(':eventId')
  async updateEvent(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    return this.adminEventsService.updateEvent(eventId, req.user.role, body);
  }

  @Delete(':eventId')
  async deleteEvent(@Param('eventId') eventId: string, @Req() req: any) {
    return this.adminEventsService.deleteEvent(eventId, req.user.role);
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    return this.adminEventsService.getHistory(req.user.role);
  }

  @Get(':eventId/regions')
  async getRegions(
    @Param('eventId') eventId: string,
    @Req() req: any,
  ) {
    return this.adminEventsService.getRegionsSummary(eventId, req.user.role);
  }
}


