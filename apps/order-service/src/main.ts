import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupApp } from '@app/shared';
import { OrderServiceModule } from './order-service.module';

async function bootstrap() {
  const app = await NestFactory.create(OrderServiceModule);
  setupApp(app, { swagger: { title: 'Order Service' } });

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  Logger.log(`🚀 order-service: http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`📖 Swagger: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
