import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

// Nạp env TRƯỚC khi khởi động: cần RABBITMQ_URL + tên queue (dựng transport)
loadEnv();
loadEnv({ path: join(process.cwd(), 'apps/auth-service/.env') });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { rmqServerOptions, setupMicroservice } from '@app/shared';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap() {
  const queue = process.env.RMQ_AUTH_QUEUE;

  if (!queue) {
    throw new Error('RMQ_AUTH_QUEUE must be defined');
  }

  // Pure microservice: KHÔNG có HTTP, chỉ nghe message trên RabbitMQ queue.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthServiceModule,
    rmqServerOptions(queue),
  );
  setupMicroservice(app); // gắn ValidationPipe cho @Payload()

  await app.listen();
  Logger.log(
    `🚀 auth-service listening RabbitMQ queue "${queue}"`,
    'Bootstrap',
  );
}
bootstrap();
