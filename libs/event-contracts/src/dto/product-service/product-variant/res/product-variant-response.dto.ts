import { ApiProperty } from '@nestjs/swagger';
import { ProductAttributeValueResponseDto } from './product-attribute-response.dto';

export class ProductVariantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sku: string;

  @ApiProperty()
  price: number;

  @ApiProperty({ required: false, nullable: true })
  compareAtPrice?: number | null;

  @ApiProperty({ required: false, nullable: true })
  saleStartAt?: Date | string | null;

  @ApiProperty({ required: false, nullable: true })
  saleEndAt?: Date | string | null;

  @ApiProperty()
  stock: number;

  @ApiProperty({ required: false, nullable: true })
  imageUrl?: string;

  @ApiProperty()
  status: boolean;

  @ApiProperty()
  isOnSale: boolean;

  @ApiProperty({ required: false, nullable: true })
  discountPercent?: number | null;

  @ApiProperty({ type: [ProductAttributeValueResponseDto] })
  attributeValues: ProductAttributeValueResponseDto[];
}
