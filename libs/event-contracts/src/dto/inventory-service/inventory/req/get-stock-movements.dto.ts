import { StockRefType } from '@app/event-contracts/enums/stock.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Xem sổ cái của 1 đơn vị lưu kho, phân trang (mới nhất trước). */
export class GetStockMovementsDto {
  @ApiProperty({ enum: StockRefType, example: StockRefType.PRODUCT })
  @IsEnum(StockRefType, { message: 'refType phải là PRODUCT hoặc VARIANT' })
  refType: StockRefType;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'refId không hợp lệ' })
  refId: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page tối thiểu là 1' })
  page?: number;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(100, { message: 'limit tối đa là 100' })
  limit?: number;
}
