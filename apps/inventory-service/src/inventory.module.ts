import { Module } from '@nestjs/common';
import { buildLoggerOptions, CommonModule } from '@app/shared';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    InventoryModule,
    LoggerModule.forRoot(buildLoggerOptions('inventory-service')),
  ],
  controllers: [],
  providers: [],
})
export class InventoryServiceModule {}
