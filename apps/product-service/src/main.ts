import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupApp } from '@app/shared';
import { ProductServiceModule } from './product-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ProductServiceModule);
  setupApp(app, { swagger: { title: 'Product Service' } });

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  Logger.log(`🚀 product-service: http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`📖 Swagger: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
