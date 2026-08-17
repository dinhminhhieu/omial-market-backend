import { config as loadEnv } from 'dotenv';

import { join } from 'node:path';

// Nạp env TRƯỚC khi khởi động: root (RABBITMQ_URL, SMTP_*, tên queue) +
// .env riêng của service (DATABASE_URL — có từ 7.4 khi thêm bảng ProcessedEvent).
loadEnv();
loadEnv({ path: join(process.cwd(), 'apps/notification-service/.env') });

import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { rmqServerOptions, setupMicroservice } from '@app/shared';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  const queue = process.env.RMQ_NOTIFICATION_QUEUE ?? 'notification_queue';

  // Pure RMQ microservice — không HTTP. Nghe cùng cơ chế như 4 service kia,
  // chỉ khác: handler bên trong dùng @EventPattern (nghe event) thay vì
  // @MessagePattern (trả lời RPC).
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
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
    `🚀 notification-service listening RabbitMQ queue "${queue}"`,
    'Bootstrap',
  );
}
bootstrap();
