import { ApiProperty } from '@nestjs/swagger';
import { OptionTemplateItemResponseDto } from './option-template-item-response.dto';

export class OptionTemplateResponseDto {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  id: string;

  @ApiProperty({ example: 'Nóng/Lạnh' })
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

  @ApiProperty({
    type: () => [OptionTemplateItemResponseDto],
    required: false,
    description: 'Chỉ có khi query include items',
  })
  optionTemplateItems?: OptionTemplateItemResponseDto[];

  @ApiProperty({ example: '2026-08-03T10:37:26.521Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-03T10:37:26.521Z' })
  updatedAt: Date;
}
