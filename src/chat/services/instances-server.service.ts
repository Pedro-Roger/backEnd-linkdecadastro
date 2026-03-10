import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  OnModuleInit,
} from '@nestjs/common';
import { InstancesServerRepository } from '../repository/instances-server.repository';
import { InstanceServer } from '@prisma/client';

@Injectable()
export class InstancesServerService implements OnModuleInit {
  private readonly logger = new Logger(InstancesServerService.name);

  private cache: InstanceServer[] = [];
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 60000 * 60; // 1h

  constructor(private readonly repository: InstancesServerRepository) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  private async refreshCache() {
    try {
      this.cache = await this.repository.findAll({
        where: { status: 'active' },
      });
      this.cacheTimestamp = Date.now();
      this.logger.log(
        `[Cache] Instâncias recarregadas. Total: ${this.cache.length}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Erro ao carregar instâncias para cache: ${error.message}`,
      );
    }
  }

  async getAvailableInstance(
    type: string = 'EVOLUTION',
  ): Promise<InstanceServer> {
    if (Date.now() - this.cacheTimestamp > this.CACHE_TTL_MS) {
      await this.refreshCache();
    }

    const validInstances = this.cache.filter((i) => i.status === 'active');

    if (validInstances.length === 0) {
      this.logger.error(`Nenhuma instância disponível no cache.`);
      throw new HttpException(
        'Nenhum servidor disponível. Tente novamente mais tarde.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const instance = await this.repository.findAvailableInstance(type);

    if (!instance) {
      this.logger.error('Nenhuma instância com capacidade.');
      throw new HttpException(
        'Nenhum servidor com capacidade disponível. Tente novamente.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return instance;
  }

  async getInstanceById(id: string): Promise<InstanceServer> {
    const cached = this.cache.find((i) => i.id === id);
    if (cached) return cached;

    const instance = await this.repository.findById(id);

    if (!instance) {
      throw new HttpException('Instância não encontrada', HttpStatus.NOT_FOUND);
    }

    return instance;
  }

  async getAllInstances(forceRefresh = false) {
    if (forceRefresh || Date.now() - this.cacheTimestamp > this.CACHE_TTL_MS) {
      await this.refreshCache();
    }
    return this.cache;
  }
}
