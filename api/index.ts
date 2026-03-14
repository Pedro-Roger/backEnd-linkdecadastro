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

    app.enableCors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Serve static files if needed
    const uploadsRoot =
      process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');
    app.use('/uploads', express.static(uploadsRoot));

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
