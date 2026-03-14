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
    'https://linkdecadastro-app.vercel.app',
    'https:/wwww.linkdecadastro-app.vercel.app',

    process.env.FRONTEND_URL || 'http://localhost:5173',
  ].filter(Boolean); // Remove valores undefined/null

  app.enableCors({
    origin: true, // Allow all origins (reflects the request origin)
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
