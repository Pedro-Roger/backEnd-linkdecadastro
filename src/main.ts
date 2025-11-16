import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  app.enableCors({
    origin: [frontendUrl],
    credentials: true,
  });

  // Servir arquivos estáticos de upload em /uploads (ex: /uploads/banners/...)
  const uploadsRoot =
    process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');
  app.use('/uploads', express.static(uploadsRoot));

  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();

