import { Module } from '@nestjs/common';
import { CommonModule } from '@app/shared';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [CommonModule, PrismaModule, InventoryModule],
  controllers: [],
  providers: [],
})
export class InventoryServiceModule {}
