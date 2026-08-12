import { ApiProperty } from '@nestjs/swagger';

export class PresignUploadResponseDto {
  @ApiProperty({
    description:
      'URL đã ký — FE PUT file THẲNG lên đây (kèm đúng Content-Type)',
  })
  uploadUrl: string;

  @ApiProperty({
    example: 'products/9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d.jpg',
    description: 'Key của object trong bucket',
  })
  key: string;

  @ApiProperty({
    example: 'http://localhost:9000/omial-media/products/9a1b....jpg',
    description:
      'URL public để xem ảnh — chính là giá trị FE nhét vào Product.images',
  })
  publicUrl: string;

  @ApiProperty({ example: 600, description: 'Chữ ký sống bao lâu (giây)' })
  expiresIn: number;
}
