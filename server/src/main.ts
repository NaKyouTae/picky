import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { startMemoryLogger } from './common/memory-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const port = Number(process.env.PORT ?? 21000);
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:21001,http://localhost:21002')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Picky API')
      .setDescription('Picky 서버 API 문서')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Picky server ready on http://localhost:${port}/api`, 'Bootstrap');

  // 구독 메모리를 얼마로 잡아야 하는지 판단할 근거를 남긴다 — common/memory-logger.ts 참고
  startMemoryLogger();
}

void bootstrap();
