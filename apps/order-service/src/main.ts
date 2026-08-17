import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

// Nạp env TRƯỚC khi khởi động: cần RABBITMQ_URL + tên queue (dựng transport)
loadEnv();
loadEnv({ path: join(process.cwd(), 'apps/order-service/.env') });

import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { rmqServerOptions, setupMicroservice } from '@app/shared';
import { OrderServiceModule } from './order-service.module';

async function bootstrap() {
  const queue = process.env.RMQ_ORDER_QUEUE ?? 'order_queue';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OrderServiceModule,
    {
      ...rmqServerOptions(queue),
      bufferLogs: true,
    },
  );
  const logger = app.get(Logger);
  app.useLogger(logger);
  setupMicroservice(app);

  await app.listen();
  logger.log(
    `🚀 order-service listening RabbitMQ queue "${queue}"`,
    'Bootstrap',
  );
}
bootstrap();
