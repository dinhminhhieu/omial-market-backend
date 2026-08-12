import { StockRefType } from '@app/event-contracts/enums/stock.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Phiếu KIỂM KÊ — gửi SỐ ĐẾM THỰC TẾ (không gửi delta):
 * service tự tính `delta = actualOnHand - onHand hiện tại` và ghi 1 dòng
 * ADJUST vào sổ cái. Không bao giờ UPDATE thẳng cột onHand mà thiếu chứng từ.
 * Lý do là BẮT BUỘC — mọi điều chỉnh phải giải thích được.
 */
export class AdjustStockDto {
  @ApiProperty({ enum: StockRefType, example: StockRefType.PRODUCT })
  @IsEnum(StockRefType, { message: 'refType phải là PRODUCT hoặc VARIANT' })
  refType: StockRefType;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'refId không hợp lệ' })
  refId: string;

  @ApiProperty({
    example: 47,
    description: 'Số lượng đếm được thực tế trong kho',
  })
  @IsInt({ message: 'Số lượng thực tế phải là số nguyên' })
  @Min(0, { message: 'Số lượng thực tế không được âm' })
  actualOnHand: number;

  @ApiProperty({ example: 'Kiểm kê cuối tháng — lệch 3 do vỡ hàng' })
  @IsString()
  @IsNotEmpty({ message: 'Lý do điều chỉnh không được để trống' })
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  @Transform(({ value }: { value?: string }) => value?.trim())
  reason: string;
}
