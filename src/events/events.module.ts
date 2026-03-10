import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';
import { MunicipalitiesRepository } from './municipalities.repository';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsRepository, MunicipalitiesRepository, PrismaService],
  exports: [EventsRepository, MunicipalitiesRepository],
})
export class EventsModule { }
