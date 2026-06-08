import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventCityService } from './event-city.service';
import { EventCityPublicController } from './event-city-public.controller';
import { EventCityAdminController } from './event-city-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EventCityPublicController, EventCityAdminController],
  providers: [EventCityService],
  exports: [EventCityService],
})
export class EventCityModule {}
