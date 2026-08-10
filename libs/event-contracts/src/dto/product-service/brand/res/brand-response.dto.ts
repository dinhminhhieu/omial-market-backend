import { ApiProperty } from '@nestjs/swagger';

export class BrandResponseDto {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  id: string;

  @ApiProperty({ example: 'Omial' })
  name: string;

  @ApiProperty({
    example: 'https://cdn.omial.dev/brands/omial.png',
    required: false,
    nullable: true,
  })
  logo?: string | null;

  @ApiProperty({
    example: 'Thương hiệu nội thất cao cấp.',
    required: false,
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({ example: '2026-07-28T10:37:26.521Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-28T10:37:26.521Z' })
  updatedAt: Date;
}
