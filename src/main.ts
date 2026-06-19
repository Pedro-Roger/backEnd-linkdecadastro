import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function getClientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0];
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message: string;
}) {
  const { windowMs, max, keyPrefix, message } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const current = rateLimitBuckets.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitBuckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );

      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        statusCode: 429,
        message,
      });
    }

    current.count += 1;
    rateLimitBuckets.set(key, current);
    return next();
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = [
    'https://linkdecadastro.com.br',
    'https://www.linkdecadastro.com.br',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://linkdecadastro-app.vercel.app',
    'https://www.linkdecadastro-app.vercel.app',
    // FRONTEND_URL aceita múltiplas origens separadas por vírgula
    ...(process.env.FRONTEND_URL || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ].filter(Boolean);

  const isAllowedOrigin = (origin: string): boolean => {
    if (allowedOrigins.includes(origin)) return true;
    // Qualquer deploy *.vercel.app (produção + previews)
    try {
      const host = new URL(origin).hostname;
      if (host === 'vercel.app' || host.endsWith('.vercel.app')) return true;
    } catch {
      /* origin inválida */
    }
    return false;
  };

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] origin bloqueada: ${origin}`);
      return callback(new Error('Origin nao permitida pelo CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });

  app.use(
    '/auth',
    createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 20,
      keyPrefix: 'auth',
      message:
        'Muitas tentativas de autenticacao. Aguarde alguns minutos antes de tentar novamente.',
    }),
  );

  app.use(
    '/api/whatsapp',
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 120,
      keyPrefix: 'whatsapp',
      message:
        'Muitas requisicoes ao modulo de WhatsApp. Aguarde um pouco e tente novamente.',
    }),
  );

  app.use(
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 300,
      keyPrefix: 'global',
      message:
        'Muitas requisicoes para a API. Aguarde um momento antes de tentar novamente.',
    }),
  );

  const uploadsRoot =
    process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');
  app.use('/uploads', express.static(uploadsRoot));

  await app.listen(process.env.PORT ?? 3333);
}

bootstrap();
