import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CityGroupStatus, GroupJobStatus } from '@prisma/client';

@Injectable()
export class EventGroupsService {
  private logger = new Logger(EventGroupsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
  ) {}

  async enqueueIfEligible(registrationId: string, eventId: string, phone: string, name: string, city: string, state: string) {
    try {
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });
      // Precisa estar habilitado e ter uma conta WhatsApp escolhida.
      if (!event?.whatsappGroupsEnabled || !event.whatsappSessionId) return;

      // Cria o grupo-da-cidade na hora se ainda não existir (1 grupo por cidade).
      let cityGroup = await this.prisma.eventCityGroup.findUnique({
        where: { eventId_city_state: { eventId, city, state } },
      });

      if (!cityGroup) {
        cityGroup = await this.prisma.eventCityGroup.create({
          data: {
            eventId,
            city,
            state,
            sessionId: event.whatsappSessionId,
            status: CityGroupStatus.ENABLED,
          },
        });
      }

      if (cityGroup.status === CityGroupStatus.FAILED) return;

      await this.prisma.whatsappGroupJob.upsert({
        where: { registrationId_cityGroupId: { registrationId, cityGroupId: cityGroup.id } },
        create: { registrationId, cityGroupId: cityGroup.id, phone, name, status: GroupJobStatus.PENDING },
        update: { status: GroupJobStatus.PENDING, nextRunAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`enqueueIfEligible fail: ${err.message}`);
    }
  }

  async processJob(job: any) {
    const cityGroup = await this.prisma.eventCityGroup.findUnique({ where: { id: job.cityGroupId } });
    if (!cityGroup || cityGroup.status === CityGroupStatus.FAILED) {
      await this.markJobFailed(job.id, 'City group failed or not found');
      return;
    }

    try {
      if (!cityGroup.groupJid) {
        await this.lazyCreateGroup(cityGroup, job);
      } else {
        await this.addToExistingGroup(cityGroup, job);
      }
    } catch (err) {
      await this.handleRetry(job, err.message);
    }
  }

  private async lazyCreateGroup(cityGroup: any, job: any) {
    const updated = await this.prisma.eventCityGroup.updateMany({
      where: { id: cityGroup.id, status: { not: CityGroupStatus.PENDING_CREATE } },
      data: { status: CityGroupStatus.PENDING_CREATE },
    });

    if (updated.count === 0) {
      // Someone else is creating → wait
      await this.handleRetry(job, 'Lazy create in progress');
      return;
    }

    try {
      const event = await this.prisma.event.findUnique({ where: { id: cityGroup.eventId } });
      if (!event) throw new Error('Event not found');
      const groupName = `${event.title} - ${cityGroup.city}`.substring(0, 100);
      const jid = await this.whatsapp.createGroup(cityGroup.sessionId, groupName, [job.phone]);

      await this.prisma.eventCityGroup.update({
        where: { id: cityGroup.id },
        data: { groupJid: jid, status: CityGroupStatus.ACTIVE },
      });

      await this.markJobDone(job.id);
    } catch (err) {
      await this.prisma.eventCityGroup.update({
        where: { id: cityGroup.id },
        data: { status: CityGroupStatus.ENABLED },
      });
      await this.handleRetry(job, err.message);
    }
  }

  private async addToExistingGroup(cityGroup: any, job: any) {
    const results = await this.whatsapp.addParticipantsToGroup(cityGroup.sessionId, cityGroup.groupJid, [job.phone]);
    const status = results[0]?.status;

    if (status === '200' || status === '409') {
      await this.markJobDone(job.id);
    } else if (status === '403') {
      await this.sendInvite(cityGroup, job);
      await this.markJobInvited(job.id);
    } else if (status?.includes('capacity') || status?.includes('full')) {
      await this.prisma.eventCityGroup.update({
        where: { id: cityGroup.id },
        data: { status: CityGroupStatus.FULL },
      });
      await this.sendInvite(cityGroup, job);
      await this.markJobInvited(job.id);
    } else {
      await this.handleRetry(job, `Status ${status}`);
    }
  }

  private async sendInvite(cityGroup: any, job: any) {
    let code = cityGroup.inviteCode;
    if (!code) {
      code = await this.whatsapp.getGroupInviteLink(cityGroup.sessionId, cityGroup.groupJid);
      await this.prisma.eventCityGroup.update({
        where: { id: cityGroup.id },
        data: { inviteCode: code },
      });
    }

    const link = `https://chat.whatsapp.com/${code}`;
    await this.whatsapp.sendMessageToPhone(job.phone, `Olá ${job.name.split(' ')[0]}! Entre no grupo do evento: ${link}`);
  }

  private async handleRetry(job: any, err: string) {
    const nextAttempt = job.attempts + 1;
    if (nextAttempt >= job.maxAttempts) {
      await this.markJobFailed(job.id, err);
    } else {
      const backoff = [30, 120, 600, 1800, 7200][nextAttempt - 1] || 7200; // 30s, 2m, 10m, 30m, 2h
      await this.prisma.whatsappGroupJob.update({
        where: { id: job.id },
        data: {
          attempts: nextAttempt,
          status: GroupJobStatus.PENDING,
          nextRunAt: new Date(Date.now() + backoff * 1000),
          lastError: err,
        },
      });
    }
  }

  private async markJobDone(jobId: string) {
    await this.prisma.whatsappGroupJob.update({
      where: { id: jobId },
      data: { status: GroupJobStatus.DONE },
    });
  }

  private async markJobInvited(jobId: string) {
    await this.prisma.whatsappGroupJob.update({
      where: { id: jobId },
      data: { status: GroupJobStatus.INVITED },
    });
  }

  private async markJobFailed(jobId: string, err: string) {
    await this.prisma.whatsappGroupJob.update({
      where: { id: jobId },
      data: { status: GroupJobStatus.FAILED, lastError: err },
    });
  }
}
