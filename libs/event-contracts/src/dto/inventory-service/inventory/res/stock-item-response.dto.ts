import { StockRefType } from '@app/event-contracts/enums/stock.enum';
import { ApiProperty } from '@nestjs/swagger';

export class StockItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: StockRefType })
  refType: StockRefType;

  @ApiProperty({ description: 'id Product/Variant bên product-service' })
  refId: string;

  @ApiProperty()
  sku: string;

  @ApiProperty({ description: 'Số đang nằm trong kho vật lý' })
  onHand: number;

  @ApiProperty({ description: 'Số đã bị đơn hàng giữ chỗ (Phase 2)' })
  reserved: number;

  @ApiProperty({
    description: 'onHand - reserved — SỐ CHO KHÁCH XEM, service tự tính',
  })
  available: number;

  @ApiProperty()
  updatedAt: Date | string;
}
