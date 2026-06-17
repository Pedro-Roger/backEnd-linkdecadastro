import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EventGroupsService } from './event-groups.service';
import { EventGroupsWorker } from './event-groups.worker';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  providers: [EventGroupsService, EventGroupsWorker],
  exports: [EventGroupsService],
})
export class EventGroupsModule {}
