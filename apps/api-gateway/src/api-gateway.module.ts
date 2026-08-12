import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { CommonModule, rmqClientOptions } from '@app/shared';
import { AUTH_CLIENT, INVENTORY_CLIENT, PRODUCT_CLIENT } from './clients';
import {
  BrandController,
  CategoryController,
  LabelController,
  OptionTemplateController,
  ProductController,
} from './product-service';
import { AuthController } from './auth-service';
import { InventoryController } from './inventory-service';

@Module({
  imports: [
    CommonModule,
    ClientsModule.registerAsync([
      {
        name: AUTH_CLIENT,
        useFactory: () =>
          rmqClientOptions(process.env.RMQ_AUTH_QUEUE ?? 'auth_queue'),
      },
      {
        name: PRODUCT_CLIENT,
        useFactory: () =>
          rmqClientOptions(process.env.RMQ_PRODUCT_QUEUE ?? 'product_queue'),
      },
      {
        name: INVENTORY_CLIENT,
        useFactory: () =>
          rmqClientOptions(
            process.env.RMQ_INVENTORY_QUEUE ?? 'inventory_queue',
          ),
      },
    ]),
  ],
  controllers: [
    AuthController,
    BrandController,
    LabelController,
    CategoryController,
    OptionTemplateController,
    ProductController,
    InventoryController,
  ],
})
export class ApiGatewayModule {}
