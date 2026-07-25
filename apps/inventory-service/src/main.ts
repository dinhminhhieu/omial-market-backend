import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupApp } from '@app/shared';
import { InventoryServiceModule } from './inventory-service.module';

async function bootstrap() {
  const app = await NestFactory.create(InventoryServiceModule);
  setupApp(app, { swagger: { title: 'Inventory Service' } });

  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  Logger.log(`🚀 inventory-service: http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`📖 Swagger: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
