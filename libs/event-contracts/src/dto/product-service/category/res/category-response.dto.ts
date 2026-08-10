import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  id: string;

  @ApiProperty({ example: 'Bàn ăn' })
  name: string;

  @ApiProperty({ example: 'ban-an' })
  slug: string;

  @ApiProperty({
    example: 'https://cdn.omial.dev/categories/ban-an.png',
    required: false,
    nullable: true,
  })
  imageUrl?: string | null;

  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: 0 })
  priority: number;

  @ApiProperty({
    example: 'Các loại bàn ăn gia đình.',
    required: false,
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    example: null,
    required: false,
    nullable: true,
    description: 'null nếu là danh mục gốc',
  })
  parentId?: string | null;

  @ApiProperty({
    type: () => [CategoryResponseDto],
    required: false,
    description: 'Danh mục con — chỉ có khi endpoint trả dạng cây',
  })
  children?: CategoryResponseDto[];

  @ApiProperty({ example: '2026-07-31T10:37:26.521Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-31T10:37:26.521Z' })
  updatedAt: Date;
}
