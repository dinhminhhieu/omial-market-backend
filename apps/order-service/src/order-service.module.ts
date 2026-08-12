import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { CommonModule, rmqClientOptions } from '@app/shared';
import { INVENTORY_CLIENT, PRODUCT_CLIENT } from './clients';
import { PrismaModule } from './prisma/prisma.module';
import { OrderServiceController } from './order-service.controller';
import { OrderServiceService } from './order-service.service';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    ClientsModule.registerAsync([
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
  controllers: [OrderServiceController],
  providers: [OrderServiceService],
})
export class OrderServiceModule {}
