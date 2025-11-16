import { Module } from '@nestjs/common';
import { AdminEventsController } from './admin-events.controller';
import { AdminEventsService } from './admin-events.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AdminEventsController],
  providers: [AdminEventsService, PrismaService],
})
export class AdminEventsModule {}


