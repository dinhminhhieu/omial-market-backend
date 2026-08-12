import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AdjustStockDto,
  GetStockDto,
  GetStockMovementsDto,
  INVENTORY_PATTERNS,
  IssueStockDto,
  ReceiveStockDto,
  StockItemResponseDto,
  StockMovementResponseDto,
} from '@app/event-contracts';
import { PaginationMetaDto } from '@app/shared';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @MessagePattern(INVENTORY_PATTERNS.GET_STOCK)
  async getStock(@Payload() dto: GetStockDto): Promise<StockItemResponseDto[]> {
    return this.inventoryService.getStock(dto);
  }

  @MessagePattern(INVENTORY_PATTERNS.RECEIVE)
  async receive(
    @Payload() dto: ReceiveStockDto,
  ): Promise<StockItemResponseDto> {
    return this.inventoryService.receive(dto);
  }

  @MessagePattern(INVENTORY_PATTERNS.ISSUE)
  async issue(@Payload() dto: IssueStockDto): Promise<StockItemResponseDto> {
    return this.inventoryService.issue(dto);
  }

  @MessagePattern(INVENTORY_PATTERNS.ADJUST)
  async adjust(@Payload() dto: AdjustStockDto): Promise<StockItemResponseDto> {
    return this.inventoryService.adjust(dto);
  }

  @MessagePattern(INVENTORY_PATTERNS.GET_MOVEMENTS)
  async getMovements(
    @Payload() dto: GetStockMovementsDto,
  ): Promise<{ data: StockMovementResponseDto[]; meta: PaginationMetaDto }> {
    return this.inventoryService.getMovements(dto);
  }
}
