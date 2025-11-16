import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // Tipagem de eventos do Prisma pode não expor "beforeExit" em algumas versões;
    // fazemos o cast para manter compatibilidade com o TypeScript estrito.
    (this as any).$on('beforeExit', async () => {
      await app.close();
    });
  }

  // Exemplo de extensão futura (logs, soft delete, etc.)
}


