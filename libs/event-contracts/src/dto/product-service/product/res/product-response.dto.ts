import { ApiProperty } from '@nestjs/swagger';
import { BrandResponseDto } from '../../brand/res/brand-response.dto';
import { CategoryResponseDto } from '../../category/res/category-response.dto';
import { LabelResponseDto } from '../../label/res/label-response.dto';
import { ProductOptionGroupResponseDto } from '../../product-option/res/product-option-group-response.dto';
import { ProductType } from 'apps/product-service/src/generated/prisma/enums';
import { ProductAttributeResponseDto } from '../../product-variant/res/product-attribute-response.dto';
import { ProductVariantResponseDto } from '../../product-variant/res/product-variant-response.dto';

export class ProductResponseDto {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  id: string;

  @ApiProperty({ example: 'Bàn ăn gỗ sồi Omial 6 ghế' })
  name: string;

  @ApiProperty({ enum: ProductType, example: ProductType.OPTION })
  type: ProductType;

  @ApiProperty({ example: 'ban-an-go-soi-omial-6-ghe' })
  slug: string;

  @ApiProperty({ example: 'BAN-GS-06' })
  sku: string;

  @ApiProperty({
    example: 'https://cdn.omial.dev/products/ban-an-go-soi.png',
    required: false,
    nullable: true,
  })
  thumbnail?: string | null;

  @ApiProperty({
    example: ['https://cdn.omial.dev/products/ban-an-1.png'],
    type: [String],
  })
  images: string[];

  @ApiProperty({ example: true })
  enablePrice: boolean;

  @ApiProperty({
    example: 4590000,
    description: 'Service convert từ Prisma Decimal → number trước khi trả',
  })
  price: number;

  @ApiProperty({ example: 4990000, required: false, nullable: true })
  compareAtPrice?: number | null;

  @ApiProperty({
    example: '2026-08-01T00:00:00Z',
    required: false,
    nullable: true,
  })
  saleStartAt?: Date | string | null;

  @ApiProperty({
    example: '2026-08-15T23:59:59Z',
    required: false,
    nullable: true,
  })
  saleEndAt?: Date | string | null;

  @ApiProperty({ example: true })
  isOnSale: boolean;

  @ApiProperty({ example: 13, required: false, nullable: true })
  discountPercent?: number | null;

  @ApiProperty({
    example: 'Bàn ăn gỗ sồi tự nhiên...',
    required: false,
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    example: 'Bàn ăn 6 ghế, gỗ sồi.',
    required: false,
    nullable: true,
  })
  shortDescription?: string | null;

  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: 0 })
  priority: number;

  @ApiProperty({ example: 'bộ', required: false, nullable: true })
  unit?: string | null;

  @ApiProperty({ example: 45.5, required: false, nullable: true })
  weight?: number | null;

  @ApiProperty({ example: 'kg', required: false, nullable: true })
  weightUnit?: string | null;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  categoryId: string;

  @ApiProperty({
    example: null,
    required: false,
    nullable: true,
  })
  brandId?: string | null;

  @ApiProperty({
    type: () => CategoryResponseDto,
    required: false,
    description: 'Chỉ có khi query include category',
  })
  category?: CategoryResponseDto;

  @ApiProperty({
    type: () => BrandResponseDto,
    required: false,
    nullable: true,
    description: 'Chỉ có khi query include brand',
  })
  brand?: BrandResponseDto | null;

  @ApiProperty({
    type: () => [LabelResponseDto],
    required: false,
    description:
      'Chỉ có khi query include labels (map từ bảng nối ProductLabel)',
  })
  labels?: LabelResponseDto[];

  @ApiProperty({
    type: () => [ProductOptionGroupResponseDto],
    required: false,
    description: 'Chỉ có khi query include productOptionGroups ',
  })
  productOptionGroups?: ProductOptionGroupResponseDto[];

  @ApiProperty({
    type: () => [ProductAttributeResponseDto],
    required: false,
    description: 'Chỉ có khi query include productAttributes (type = VARIANT)',
  })
  productAttributes?: ProductAttributeResponseDto[];

  @ApiProperty({
    type: () => [ProductVariantResponseDto],
    required: false,
    description: 'Chỉ có khi query include productVariants (type = VARIANT)',
  })
  productVariants?: ProductVariantResponseDto[];

  @ApiProperty({ example: '2026-08-03T10:37:26.521Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-03T10:37:26.521Z' })
  updatedAt: Date;
}
