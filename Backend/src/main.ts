import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { abortOnError: false, logger: false, bodyParser: false });
  // ZIP y modelo se reciben codificados en JSON; el límite evita que una carga
  // accidental agote memoria y deja margen para la expansión Base64.
  app.use(require('express').json({ limit: '22mb' }));
  app.useLogger(new Logger());
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get<string[]>('CORS_ORIGINS'), credentials: false });
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'), config.getOrThrow<string>('HOST'));
  Logger.log('API iniciada; GET /health comprueba la conexión con BD.', 'Bootstrap');
}
bootstrap().catch(() => {
  // Never print a connection string or a raw Prisma error (may contain credentials).
  Logger.error('No se pudo iniciar la API. Revisa Node, Backend/.env y la disponibilidad de MySQL.', undefined, 'Bootstrap');
  process.exitCode = 1;
});
