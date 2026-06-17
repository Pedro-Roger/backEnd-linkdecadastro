import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventGroupsService } from './event-groups.service';
import { GroupJobStatus } from '@prisma/client';

@Injectable()
export class EventGroupsWorker {
  private logger = new Logger(EventGroupsWorker.name);
  private readonly BATCH_SIZE = 10;
  private readonly POLL_MS = parseInt(process.env.EVENT_GROUPS_POLL_MS || '10000');

  constructor(
    private prisma: PrismaService,
    private eventGroupsService: EventGroupsService,
  ) {}

  @Interval(10000)
  async processJobs() {
    const jobs = await this.prisma.whatsappGroupJob.findMany({
      where: {
        status: GroupJobStatus.PENDING,
        nextRunAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: this.BATCH_SIZE,
    });

    if (jobs.length === 0) return;

    for (const job of jobs) {
      await this.prisma.whatsappGroupJob.update({
        where: { id: job.id },
        data: { status: GroupJobStatus.PROCESSING },
      });

      try {
        await this.eventGroupsService.processJob(job);
      } catch (err) {
        this.logger.error(`Job ${job.id} error: ${err.message}`);
        await this.prisma.whatsappGroupJob.update({
          where: { id: job.id },
          data: { status: GroupJobStatus.PENDING, nextRunAt: new Date(Date.now() + 60000) },
        });
      }
    }
  }
}
