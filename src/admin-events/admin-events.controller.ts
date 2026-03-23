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
import { UpdateEventDto } from './dto/update-event.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly adminEventsService: AdminEventsService) { }

  @Patch(':eventId')
  async updateEvent(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() body: UpdateEventDto,
  ) {
    return this.adminEventsService.updateEvent(
      eventId,
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Delete(':eventId')
  async deleteEvent(@Param('eventId') eventId: string, @Req() req: any) {
    return this.adminEventsService.deleteEvent(
      eventId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    return this.adminEventsService.getHistory(req.user.id, req.user.role);
  }

  @Get(':eventId/regions')
  async getRegions(@Param('eventId') eventId: string, @Req() req: any) {
    return this.adminEventsService.getRegionsSummary(
      eventId,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':eventId/registrations')
  async listRegistrations(@Param('eventId') eventId: string, @Req() req: any) {
    return this.adminEventsService.listEventRegistrations(
      eventId,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':eventId/export')
  async exportRegistrations(
    @Param('eventId') eventId: string,
    @Query('format') format: string | undefined,
    @Query('classId') classId: string | undefined,
    @Query('municipalityId') municipalityId: string | undefined,
    @Query('city') city: string | undefined, // NEW
    @Query('state') state: string | undefined, // NEW
    @Query('fields') fields: string | undefined,
    @Req() req: any & { res?: Response },
  ) {
    const fieldsArray =
      typeof fields === 'string'
        ? fields.split(',').map((f) => f.trim())
        : (fields as string[] | undefined);

    const result = await this.adminEventsService.exportRegistrations(
      eventId,
      req.user.id,
      req.user.role,
      format,
      fieldsArray,
      classId,
      municipalityId,
      city,
      state,
    );

    const res = req.res as Response;
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.end(result.buffer);
  }

  @Get(':eventId')
  async getEvent(@Param('eventId') eventId: string, @Req() req: any) {
    return this.adminEventsService.getEventById(
      eventId,
      req.user.id,
      req.user.role,
    );
  }

  @Patch('limits/:limitId')
  async updateMunicipalityLimit(
    @Param('limitId') limitId: string,
    @Req() req: any,
    @Body() body: { defaultLimit?: number },
  ) {
    return this.adminEventsService.updateMunicipalityLimit(
      limitId,
      req.user.id,
      req.user.role,
      body,
    );
  }

  @Patch('classes/:classId/close')
  async closeClass(@Param('classId') classId: string, @Req() req: any) {
    return this.adminEventsService.closeClass(
      classId,
      req.user.id,
      req.user.role,
    );
  }

  @Delete('registrations/:registrationId')
  async deleteRegistration(
    @Param('registrationId') registrationId: string,
    @Req() req: any,
  ) {
    return this.adminEventsService.deleteRegistration(
      registrationId,
      req.user.id,
      req.user.role,
    );
  }
}
