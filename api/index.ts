import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';

const server = express();

let isAppInitialized = false;

export const bootstrap = async (expressInstance: express.Express) => {
  try {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressInstance),
    );

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
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[];

    app.enableCors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Serve static files if needed
    const uploadsRoot =
      process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');
    app.use('/uploads', express.static(uploadsRoot));

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not defined in environment variables');
    } else {
        console.log('DATABASE_URL is defined');
    }

    await app.init();
    isAppInitialized = true;
    console.log('NestJS App Initialized');
  } catch (error) {
    console.error('Error during NestJS bootstrap:', error);
    throw error;
  }
};

// Middleware to ensure app is bootstrapped
server.all('*', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!isAppInitialized) {
    try {
      await bootstrap(server);
    } catch (error) {
      return res.status(500).json({
        statusCode: 500,
        message: 'Internal Server Error during bootstrap',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  next();
});

export default server;
