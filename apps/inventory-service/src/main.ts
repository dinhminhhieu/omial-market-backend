import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

// Nạp env TRƯỚC khi khởi động: cần RABBITMQ_URL + tên queue (dựng transport)
loadEnv();
loadEnv({ path: join(process.cwd(), 'apps/inventory-service/.env') });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { rmqServerOptions, setupMicroservice } from '@app/shared';
import { InventoryServiceModule } from './inventory.module';

async function bootstrap() {
  const queue = process.env.RMQ_INVENTORY_QUEUE ?? 'inventory_queue';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    InventoryServiceModule,
    rmqServerOptions(queue),
  );
  setupMicroservice(app);

  await app.listen();
  Logger.log(
    `🚀 inventory-service listening RabbitMQ queue "${queue}"`,
    'Bootstrap',
  );
}
bootstrap();
