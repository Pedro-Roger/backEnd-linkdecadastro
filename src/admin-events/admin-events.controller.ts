import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
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

  @Get(':eventId/registrations')
  async listRegistrations(
    @Param('eventId') eventId: string,
    @Req() req: any,
  ) {
    return this.adminEventsService.listEventRegistrations(
      eventId,
      req.user.role,
    );
  }

  @Get(':eventId/export')
  async exportRegistrations(
    @Param('eventId') eventId: string,
    @Query('format') format: string | undefined,
    @Query('fields') fields: string | string[] | undefined,
    @Req() req: any & { res?: Response },
  ) {
    const fieldsArray =
      typeof fields === 'string'
        ? fields.split(',').map((f) => f.trim())
        : (fields as string[] | undefined);

    const result = await this.adminEventsService.exportRegistrations(
      eventId,
      req.user.role,
      format,
      fieldsArray,
    );

    const res = req.res as Response;
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.end(result.buffer);
  }

  @Patch('limits/:limitId')
  async updateMunicipalityLimit(
    @Param('limitId') limitId: string,
    @Req() req: any,
    @Body() body: { defaultLimit?: number },
  ) {
    return this.adminEventsService.updateMunicipalityLimit(
      limitId,
      req.user.role,
      body,
    );
  }

  @Patch('classes/:classId/close')
  async closeClass(@Param('classId') classId: string, @Req() req: any) {
    return this.adminEventsService.closeClass(classId, req.user.role);
  }
}


