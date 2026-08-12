import { ApiProperty } from '@nestjs/swagger';
import { ProductOptionItemResponseDto } from './product-option-item-response.dto';

export class ProductOptionGroupResponseDto {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  id: string;

  @ApiProperty({ example: 'Chất liệu gỗ' })
  name: string;

  @ApiProperty({ example: 1, description: '0 = không bắt buộc chọn' })
  minSelect: number;

  @ApiProperty({
    example: 1,
    nullable: true,
    description: 'null = không giới hạn',
  })
  maxSelect: number | null;

  @ApiProperty({ example: 0 })
  position: number;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  productId: string;

  @ApiProperty({
    type: () => [ProductOptionItemResponseDto],
    required: false,
    description: 'Chỉ có khi query include productOptionItems',
  })
  // Tên field khớp với wire format thật của product-service (toResponse spread
  // quan hệ Prisma `productOptionItems`) — trước đây khai `items` là NÓI DỐI:
  // TS cho order-service đọc `.items` nhưng runtime là undefined.
  productOptionItems?: ProductOptionItemResponseDto[];

  @ApiProperty({ example: '2026-08-03T10:37:26.521Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-03T10:37:26.521Z' })
  updatedAt: Date;
}
