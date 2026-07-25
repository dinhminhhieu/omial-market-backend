import { Module } from '@nestjs/common';
import { CommonModule } from '@app/shared';
import { InventoryServiceController } from './inventory-service.controller';
import { InventoryServiceService } from './inventory-service.service';

@Module({
  imports: [CommonModule],
  controllers: [InventoryServiceController],
  providers: [InventoryServiceService],
})
export class InventoryServiceModule {}
