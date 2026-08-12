import { StockRefType } from '@app/event-contracts/enums/stock.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';

/** Định danh 1 đơn vị lưu kho: (refType, refId) — dùng chung cho các request. */
export class StockRefInputDto {
  @ApiProperty({ enum: StockRefType, example: StockRefType.PRODUCT })
  @IsEnum(StockRefType, { message: 'refType phải là PRODUCT hoặc VARIANT' })
  refType: StockRefType;

  @ApiProperty({
    example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    description: 'id của Product (SIMPLE/OPTION) hoặc ProductVariant (VARIANT)',
  })
  @IsUUID('4', { message: 'refId không hợp lệ' })
  refId: string;
}
