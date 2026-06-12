import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { RequestHandler } from 'express';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

type CorsCallback = (err: Error | null, allow?: boolean) => void;

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: isProd ? ['error', 'warn'] : ['error', 'warn', 'log', 'debug'],
  });

  app.use(cookieParser());

  // CORS_ORIGIN: '*', a single URL, or a comma-separated list
  const rawOrigins = process.env.CORS_ORIGIN ?? '';
  const allowAllOrigins = rawOrigins.trim() === '*';
  const allowedOrigins = new Set(
    rawOrigins
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter((o) => o && o !== '*'),
  );
  // Local dev + known production admin are always allowed
  allowedOrigins.add('http://localhost:3000');
  allowedOrigins.add('http://127.0.0.1:3000');
  allowedOrigins.add('https://selfless-admin.vercel.app');

  const isOriginAllowed = (origin: string): boolean => {
    if (allowAllOrigins) return true;
    const normalized = origin.replace(/\/+$/, '');
    if (allowedOrigins.has(normalized)) return true;
    // Vercel preview deployments (selfless-admin-<hash>-<team>.vercel.app)
    return /^https:\/\/selfless-admin[a-z0-9-]*\.vercel\.app$/.test(normalized);
  };

  app.enableCors({
    origin: (requestOrigin: string | undefined, callback: CorsCallback): void => {
      if (!requestOrigin || isOriginAllowed(requestOrigin)) {
        callback(null, true);
        return;
      }
      // Reject without throwing: browser blocks via missing CORS headers
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // /health excluded from global prefix so Render's health check always hits it
  app.setGlobalPrefix('api/v1', { exclude: ['/health'] });

  const healthCheck: RequestHandler = (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  };
  app.getHttpAdapter().get('/health', healthCheck);

  // Lets NestJS drain in-flight requests before Render restarts on SIGTERM
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');

  logger.log(
    `API listening on :${port} [${isProd ? 'production' : 'development'}]`,
  );
  logger.log(`Health → http://0.0.0.0:${port}/health`);
  logger.log(`REST   → http://0.0.0.0:${port}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
