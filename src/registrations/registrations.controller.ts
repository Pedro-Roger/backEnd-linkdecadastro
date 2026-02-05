import { Controller, Get, Post, Query, Body, Param, NotFoundException } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post()
  async create(@Body() body: any) {
    const registration = await this.registrationsService.handleRegistration(body);
    return registration;
  }

  @Get()
  async list(@Query('eventId') eventId?: string) {
    return this.registrationsService.listRegistrations(eventId || null);
  }

  @Get('cpf/:cpf')
  async findByCpf(@Param('cpf') cpf: string) {
    const registration = await this.registrationsService.findByCpf(cpf);
    if (!registration) {
      throw new NotFoundException('CPF não encontrado');
    }
    return registration;
  }
}


