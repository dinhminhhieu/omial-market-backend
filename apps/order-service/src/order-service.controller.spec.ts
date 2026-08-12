import { Test, TestingModule } from '@nestjs/testing';
import { OrderServiceController } from './order-service.controller';
import { OrderServiceService } from './order-service.service';
import { PrismaService } from './prisma/prisma.service';
import { INVENTORY_CLIENT, PRODUCT_CLIENT } from './clients';

describe('OrderServiceController', () => {
  let orderServiceController: OrderServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OrderServiceController],
      providers: [
        OrderServiceService,
        { provide: PrismaService, useValue: {} },
        { provide: PRODUCT_CLIENT, useValue: {} },
        { provide: INVENTORY_CLIENT, useValue: {} },
      ],
    }).compile();

    orderServiceController = app.get<OrderServiceController>(
      OrderServiceController,
    );
  });

  it('should be defined', () => {
    expect(orderServiceController).toBeDefined();
  });
});
