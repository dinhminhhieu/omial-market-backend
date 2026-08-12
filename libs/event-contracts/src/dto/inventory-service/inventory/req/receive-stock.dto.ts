import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { StockRefType } from '@app/event-contracts/enums/stock.enum';

/**
 * Phiếu NHẬP kho — lần đầu nhập sẽ tự tạo StockItem (upsert),
 * vì vậy cần gửi kèm `sku` để inventory lưu bản sao tra cứu.
 */
export class ReceiveStockDto {
  @ApiProperty({ enum: StockRefType, example: StockRefType.PRODUCT })
  @IsEnum(StockRefType, { message: 'refType phải là PRODUCT hoặc VARIANT' })
  refType: StockRefType;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'refId không hợp lệ' })
  refId: string;

  @ApiProperty({
    example: 'SKU-AO-DO-S',
    description: 'SKU của product/variant — copy sang inventory để tra cứu',
  })
  @IsString()
  @IsNotEmpty({ message: 'SKU không được để trống' })
  @MaxLength(100, { message: 'SKU tối đa 100 ký tự' })
  @Transform(({ value }: { value?: string }) => value?.trim())
  sku: string;

  @ApiProperty({ example: 50, description: 'Số lượng nhập (dương)' })
  @IsInt({ message: 'Số lượng nhập phải là số nguyên' })
  @Min(1, { message: 'Số lượng nhập tối thiểu là 1' })
  quantity: number;

  @ApiProperty({ example: 'Nhập lô hàng ngày 10/8', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  @Transform(({ value }: { value?: string }) => value?.trim())
  reason?: string;
}
