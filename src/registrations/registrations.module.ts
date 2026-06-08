import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { RegistrationsRepository } from './registrations.repository';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EventCityModule } from '../event-city/event-city.module';

@Module({
  imports: [WhatsAppModule, EventCityModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, RegistrationsRepository, PrismaService, EmailService],
  exports: [RegistrationsRepository],
})
export class RegistrationsModule { }
