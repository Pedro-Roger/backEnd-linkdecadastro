import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Module({
  controllers: [RegistrationsController],
  providers: [RegistrationsService, PrismaService, EmailService],
})
export class RegistrationsModule {}


