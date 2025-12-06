import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Lista de origens permitidas
  const allowedOrigins = [
    'https://linkdecadastro.com.br',
    'https://www.linkdecadastro.com.br',
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL || 'http://localhost:5173',
  ].filter(Boolean); // Remove valores undefined/null

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Permite requisições sem origem (mobile apps, Postman, etc) em desenvolvimento
      // Também checka se a origem termina com linkdecadastro.com.br para aceitar subdomínios
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('linkdecadastro.com.br')
      ) {
        callback(null, true);
      } else {
        console.error(`❌ [CORS] Origem bloqueada: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Servir arquivos estáticos de upload em /uploads (ex: /uploads/banners/...)
  const uploadsRoot =
    process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');
  app.use('/uploads', express.static(uploadsRoot));

  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();

