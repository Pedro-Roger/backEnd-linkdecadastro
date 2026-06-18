import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
      if (!event?.whatsappGroupsEnabled || !event.whatsappSessionId) {
        this.logger.log(`[enqueue] skip event=${eventId} enabled=${event?.whatsappGroupsEnabled} session=${event?.whatsappSessionId}`);
        return;
      }

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
        this.logger.log(`[enqueue] cityGroup criado para ${city}/${state} (event=${eventId})`);
      }

      if (cityGroup.status === CityGroupStatus.FAILED) {
        this.logger.warn(`[enqueue] cityGroup FAILED ${city}/${state}, ignorando`);
        return;
      }

      await this.prisma.whatsappGroupJob.upsert({
        where: { registrationId_cityGroupId: { registrationId, cityGroupId: cityGroup.id } },
        create: { registrationId, cityGroupId: cityGroup.id, phone, name, status: GroupJobStatus.PENDING },
        update: { status: GroupJobStatus.PENDING, nextRunAt: new Date() },
      });
      this.logger.log(`[enqueue] job criado reg=${registrationId} cidade=${city}/${state} phone=${phone}`);
    } catch (err) {
      this.logger.warn(`enqueueIfEligible fail: ${err.message}`);
    }
  }

  /**
   * Agenda os inscritos JÁ existentes de um evento para entrarem nos grupos das
   * suas cidades, em lotes de `perDay` por dia (escalonado via nextRunAt), para
   * não adicionar muita gente de uma vez (risco de bloqueio no WhatsApp).
   */
  async backfillExistingRegistrations(eventId: string, perDay = 10) {
    const limit = Math.max(1, Math.min(perDay || 10, 50));
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event?.whatsappGroupsEnabled || !event.whatsappSessionId) {
      throw new BadRequestException('Habilite os grupos de WhatsApp e selecione uma conta antes de adicionar os inscritos.');
    }

    const regs = await this.prisma.registration.findMany({
      where: { eventId, status: 'CONFIRMED' },
      select: { id: true, phone: true, name: true, city: true, state: true },
      orderBy: { createdAt: 'asc' },
    });

    // Agrupa por cidade/estado
    const byCity = new Map<string, typeof regs>();
    for (const r of regs) {
      const key = `${r.city}__${r.state}`;
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key)!.push(r);
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const DAY_MS = 24 * 60 * 60 * 1000;

    let scheduled = 0;
    let maxDays = 0;

    for (const [key, list] of byCity) {
      const [city, state] = key.split('__');

      let cg = await this.prisma.eventCityGroup.findUnique({
        where: { eventId_city_state: { eventId, city, state } },
      });
      if (!cg) {
        cg = await this.prisma.eventCityGroup.create({
          data: { eventId, city, state, sessionId: event.whatsappSessionId, status: CityGroupStatus.ENABLED },
        });
      }
      if (cg.status === CityGroupStatus.FAILED) continue;

      // Não recria jobs que já existem (inscritos novos já enfileirados)
      const existingJobs = await this.prisma.whatsappGroupJob.findMany({
        where: { cityGroupId: cg.id },
        select: { registrationId: true },
      });
      const seen = new Set(existingJobs.map((j) => j.registrationId));

      let idx = 0;
      for (const r of list) {
        if (seen.has(r.id)) continue;
        const dayOffset = Math.floor(idx / limit);
        const nextRunAt = new Date(dayStart.getTime() + dayOffset * DAY_MS);
        await this.prisma.whatsappGroupJob.create({
          data: {
            registrationId: r.id,
            cityGroupId: cg.id,
            phone: r.phone,
            name: r.name,
            status: GroupJobStatus.PENDING,
            nextRunAt,
          },
        });
        idx++;
        scheduled++;
        maxDays = Math.max(maxDays, dayOffset + 1);
      }
      this.logger.log(`[backfill] cidade ${city}/${state}: ${idx} agendados`);
    }

    this.logger.log(`[backfill] evento=${eventId} total=${scheduled} dias=${maxDays} perDay=${limit}`);
    return { scheduled, days: maxDays, perDay: limit, cities: byCity.size };
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

  /**
   * Detecta erros de CONEXÃO do WhatsApp (queda temporária), que não devem
   * consumir tentativas — o job espera o WhatsApp voltar.
   */
  private isConnectionError(err: string): boolean {
    const m = (err || '').toLowerCase();
    return (
      m.includes('nao conectado') ||
      m.includes('não conectado') ||
      m.includes('qr code') ||
      m.includes('escaneie') ||
      m.includes('connection') ||
      m.includes('socket') ||
      m.includes('timed out') ||
      m.includes('timeout') ||
      m.includes('econn')
    );
  }

  private async handleRetry(job: any, err: string) {
    // Queda de conexão: NÃO conta como tentativa. Re-agenda fixo (2 min) e
    // segue tentando indefinidamente até o WhatsApp voltar a ficar READY.
    if (this.isConnectionError(err)) {
      await this.prisma.whatsappGroupJob.update({
        where: { id: job.id },
        data: {
          status: GroupJobStatus.PENDING,
          nextRunAt: new Date(Date.now() + 120 * 1000),
          lastError: `[aguardando WhatsApp conectar] ${err}`,
        },
      });
      this.logger.warn(`[job ${job.id}] WhatsApp offline — re-agendado em 2min sem consumir tentativa`);
      return;
    }

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
