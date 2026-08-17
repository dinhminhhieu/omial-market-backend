import { config as loadEnv } from 'dotenv';
// Gateway cần RABBITMQ_URL + tên queue để dựng ClientProxy lúc khởi động.
loadEnv(); // root .env

import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { setupApp } from '@app/shared';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  setupApp(app, { swagger: { title: 'API Gateway' } });

  const port = process.env.PORT ?? 8000;
  await app.listen(port);
  logger.log(`🚀 api-gateway: http://localhost:${port}/api`, 'Bootstrap');
  logger.log(`📖 Swagger: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
