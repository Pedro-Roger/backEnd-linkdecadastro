import { Module } from '@nestjs/common';
import { AdminEventsController } from './admin-events.controller';
import { AdminEventsService } from './admin-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsModule } from '../events/events.module';
import { RegistrationsModule } from '../registrations/registrations.module';

@Module({
  imports: [EventsModule, RegistrationsModule],
  controllers: [AdminEventsController],
  providers: [AdminEventsService, PrismaService],
})
export class AdminEventsModule { }
