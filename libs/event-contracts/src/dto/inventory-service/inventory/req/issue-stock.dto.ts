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
 * Phiếu XUẤT kho thủ công — hủy/hỏng, dùng nội bộ, trả nhà cung cấp.
 * KHÔNG dùng cho xuất bán (SALE sinh tự động từ đơn hàng, Phase 2).
 * Gửi SỐ LƯỢNG XUẤT (dương) — service ghi movement ISSUE với delta âm,
 * và chỉ cho xuất trong phạm vi available (onHand - reserved): hàng đã
 * giữ chỗ cho đơn là hàng có chủ, không được đem xuất.
 * Lý do BẮT BUỘC — xuất tay luôn phải giải thích được.
 */
export class IssueStockDto {
  @ApiProperty({ enum: StockRefType, example: StockRefType.PRODUCT })
  @IsEnum(StockRefType, { message: 'refType phải là PRODUCT hoặc VARIANT' })
  refType: StockRefType;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'refId không hợp lệ' })
  refId: string;

  @ApiProperty({ example: 3, description: 'Số lượng xuất (dương)' })
  @IsInt({ message: 'Số lượng xuất phải là số nguyên' })
  @Min(1, { message: 'Số lượng xuất tối thiểu là 1' })
  quantity: number;

  @ApiProperty({ example: 'Xuất hủy — vỡ 3 ly khi vận chuyển' })
  @IsString()
  @IsNotEmpty({ message: 'Lý do xuất kho không được để trống' })
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  @Transform(({ value }: { value?: string }) => value?.trim())
  reason: string;
}
