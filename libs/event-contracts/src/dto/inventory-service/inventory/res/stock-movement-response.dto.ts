import { StockMovementType } from '@app/event-contracts/enums/stock.enum';
import { ApiProperty } from '@nestjs/swagger';

export class StockMovementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  stockItemId: string;

  @ApiProperty({ enum: StockMovementType })
  type: StockMovementType;

  @ApiProperty({ description: 'Có dấu: +5 nhập, -3 xuất' })
  delta: number;

  @ApiProperty({ required: false, nullable: true })
  reason?: string | null;

  @ApiProperty({ required: false, nullable: true })
  refType?: string | null;

  @ApiProperty({ required: false, nullable: true })
  refId?: string | null;

  @ApiProperty()
  createdAt: Date | string;
}

// Response của inventory.get_movements dùng envelope phân trang chuẩn nhà:
// { data: StockMovementResponseDto[]; meta: PaginationMetaDto } — PaginationMetaDto
// nằm ở @app/shared, không định nghĩa lại envelope trong contracts.
