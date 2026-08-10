import { ApiProperty } from '@nestjs/swagger';

export class ProductOptionItemResponseDto {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  id: string;

  @ApiProperty({ example: 'Gỗ óc chó' })
  name: string;

  @ApiProperty({
    example: 2000000,
    description: 'Service convert từ Prisma Decimal → number trước khi trả',
  })
  extraPrice: number;

  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: false })
  isDefault: boolean;

  @ApiProperty({ example: 0 })
  position: number;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  productOptionGroupId: string;

  @ApiProperty({ example: '2026-08-03T10:37:26.521Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-03T10:37:26.521Z' })
  updatedAt: Date;
}
