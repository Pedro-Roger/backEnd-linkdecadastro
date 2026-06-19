import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventGroupsService } from './event-groups.service';
import { GroupJobStatus } from '@prisma/client';

@Injectable()
export class EventGroupsWorker {
  private logger = new Logger(EventGroupsWorker.name);
  private readonly BATCH_SIZE = 10;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private eventGroupsService: EventGroupsService,
  ) {}

  @Interval(10000)
  async processJobs() {
    // Trava de execução única: evita ticks sobrepostos que geram write
    // conflicts (P2034) ao atualizar os mesmos jobs em paralelo.
    if (this.running) return;
    this.running = true;
    try {
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
        try {
          await this.prisma.whatsappGroupJob.update({
            where: { id: job.id },
            data: { status: GroupJobStatus.PROCESSING },
          });
          await this.eventGroupsService.processJob(job);
        } catch (err: any) {
          this.logger.error(`Job ${job.id} error: ${err?.message}`);
          await this.prisma.whatsappGroupJob
            .update({
              where: { id: job.id },
              data: { status: GroupJobStatus.PENDING, nextRunAt: new Date(Date.now() + 60000) },
            })
            .catch(() => undefined);
        }
      }
    } catch (err: any) {
      this.logger.error(`processJobs falhou: ${err?.message}`);
    } finally {
      this.running = false;
    }
  }
}
