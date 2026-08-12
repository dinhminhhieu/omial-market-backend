import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * 1 dòng trong giỏ khi checkout — CHỈ CÓ ID + SỐ LƯỢNG, KHÔNG CÓ GIÁ.
 * Nguyên tắc vàng: không bao giờ tin giá từ client — order-service tự gọi
 * product-service lấy giá hiện hành rồi snapshot.
 */
export class CreateOrderItemInputDto {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'productId không hợp lệ' })
  productId: string;

  @ApiProperty({
    required: false,
    description: 'Bắt buộc khi sản phẩm type VARIANT',
  })
  @IsOptional()
  @IsUUID('4', { message: 'variantId không hợp lệ' })
  variantId?: string;

  @ApiProperty({ example: 2 })
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(999, { message: 'Số lượng tối đa 999' })
  quantity: number;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Các ProductOptionItem id khách đã chọn (sản phẩm type OPTION)',
  })
  @IsOptional()
  @IsUUID('4', { each: true, message: 'optionItemId không hợp lệ' })
  @ArrayMaxSize(50, { message: 'Tối đa 50 option mỗi dòng' })
  optionItemIds?: string[];
}
