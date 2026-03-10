import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LessonsController],
  providers: [LessonsService, PrismaService],
})
export class LessonsModule {}
