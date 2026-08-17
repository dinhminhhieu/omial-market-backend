import { config as loadEnv } from 'dotenv';

// Chỉ cần env dùng chung ở root (RABBITMQ_URL, SMTP_*, tên queue).
// notification-service CHƯA có database riêng nên không có apps/.../.env.
loadEnv();

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
