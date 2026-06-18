import { Module } from '@nestjs/common';
import { AdminEventsController } from './admin-events.controller';
import { AdminEventsService } from './admin-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsModule } from '../events/events.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { EventGroupsModule } from '../event-groups/event-groups.module';

@Module({
  imports: [EventsModule, RegistrationsModule, EventGroupsModule],
  controllers: [AdminEventsController],
  providers: [AdminEventsService, PrismaService],
})
export class AdminEventsModule { }
