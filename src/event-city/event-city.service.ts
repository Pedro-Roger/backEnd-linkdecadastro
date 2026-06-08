import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CityStatus = 'OPEN' | 'FULL' | 'CLOSED';

interface MunicipalityLimitLike {
  id: string;
  isClosed: boolean;
  defaultLimit: number;
  registrationCount: number;
  closedMessage: string | null;
}

@Injectable()
export class EventCityService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly UNLIMITED = 999999;

  private isUnlimited(limit: number): boolean {
    return limit === 0 || limit >= this.UNLIMITED;
  }

  private getStatus(ec: MunicipalityLimitLike): CityStatus {
    if (ec.isClosed) return 'CLOSED';
    const count = ec.registrationCount ?? 0;
    if (!this.isUnlimited(ec.defaultLimit) && count >= ec.defaultLimit) return 'FULL';
    return 'OPEN';
  }

  private buildMessage(ec: MunicipalityLimitLike): string | null {
    const status = this.getStatus(ec);
    if (status === 'OPEN') return null;
    return ec.closedMessage ?? 'As inscrições para esta cidade estão encerradas.';
  }

  async listFull(eventId: string) {
    const limits = await this.prisma.municipalityLimit.findMany({
      where: { eventId },
      include: { classes: { select: { currentCount: true } } },
    });
    return limits.map((ec: any) => {
      const realCount = ec.classes.reduce((sum: number, c: any) => sum + (c.currentCount ?? 0), 0);
      const effectiveLimit = this.isUnlimited(ec.defaultLimit) ? 0 : ec.defaultLimit;
      const ecForStatus: MunicipalityLimitLike = {
        id: ec.id,
        isClosed: ec.isClosed ?? false,
        defaultLimit: effectiveLimit,
        registrationCount: realCount,
        closedMessage: ec.closedMessage ?? null,
      };
      return {
        id: ec.id,
        municipality: ec.municipality,
        state: ec.state,
        defaultLimit: effectiveLimit,
        registrationCount: realCount,
        isClosed: ec.isClosed ?? false,
        closedMessage: ec.closedMessage ?? null,
        status: this.getStatus(ecForStatus),
      };
    });
  }

  async listAvailable(eventId: string) {
    const limits = await this.prisma.municipalityLimit.findMany({
      where: { eventId },
    });
    return limits.map((ec) => ({
      id: ec.id,
      municipality: ec.municipality,
      state: ec.state,
      status: this.getStatus(ec as any),
      message: this.buildMessage(ec as any),
    }));
  }

  async reserveSlot(eventId: string, municipality: string, state: string) {
    const ec = await this.prisma.municipalityLimit.findFirst({
      where: { eventId, municipality, state },
    });

    if (!ec) throw new NotFoundException('Cidade não participa deste evento.');

    const status = this.getStatus(ec as any);
    if (status !== 'OPEN') {
      throw new ConflictException(this.buildMessage(ec as any));
    }

    if ((ec as any).defaultLimit === 0) {
      await this.prisma.municipalityLimit.update({
        where: { id: ec.id },
        data: { registrationCount: { increment: 1 } } as any,
      });
      return;
    }

    const result = await this.prisma.municipalityLimit.updateMany({
      where: {
        id: ec.id,
        OR: [
          { registrationCount: { lt: (ec as any).defaultLimit } },
          { registrationCount: null },
        ],
        isClosed: false,
      } as any,
      data: { registrationCount: { increment: 1 } } as any,
    });

    if (result.count === 0) {
      throw new ConflictException(
        this.buildMessage(ec as any) ?? 'Vagas esgotadas.',
      );
    }
  }

  async updateStatus(
    limitId: string,
    data: { isClosed?: boolean; closedMessage?: string | null; defaultLimit?: number },
  ) {
    return this.prisma.municipalityLimit.update({
      where: { id: limitId },
      data: data as any,
    });
  }

  async upsertCity(
    eventId: string,
    dto: { municipality: string; state: string; defaultLimit?: number },
  ) {
    const existing = await this.prisma.municipalityLimit.findFirst({
      where: { eventId, municipality: dto.municipality, state: dto.state },
    });

    if (existing) {
      return this.prisma.municipalityLimit.update({
        where: { id: existing.id },
        data: { defaultLimit: dto.defaultLimit ?? existing.defaultLimit },
      });
    }

    return this.prisma.municipalityLimit.create({
      data: {
        eventId,
        municipality: dto.municipality,
        state: dto.state,
        defaultLimit: dto.defaultLimit ?? 0,
      },
    });
  }
}
