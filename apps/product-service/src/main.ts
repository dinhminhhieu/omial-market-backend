import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

// Nạp env TRƯỚC khi khởi động: cần RABBITMQ_URL + tên queue (dựng transport)
loadEnv();
loadEnv({ path: join(process.cwd(), 'apps/product-service/.env') });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { rmqServerOptions, setupMicroservice } from '@app/shared';
import { ProductServiceModule } from './product-service.module';

async function bootstrap() {
  const queue = process.env.RMQ_PRODUCT_QUEUE ?? 'product_queue';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ProductServiceModule,
    rmqServerOptions(queue),
  );
  setupMicroservice(app); // gắn ValidationPipe cho @Payload()

  await app.listen();
  Logger.log(
    `🚀 product-service listening RabbitMQ queue "${queue}"`,
    'Bootstrap',
  );
}
bootstrap();
