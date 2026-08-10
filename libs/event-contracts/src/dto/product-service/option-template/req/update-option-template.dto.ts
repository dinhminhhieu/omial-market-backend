import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateOptionTemplateDto } from './create-option-template.dto';
import { CreateOptionTemplateItemDto } from './create-option-template-item.dto';

/**
 * Update template dạng "aggregate": sửa field mẫu + items trong 1 call.
 * `optionTemplateItems`:
 * - KHÔNG gửi → chỉ sửa field mẫu, không đụng items.
 * - Gửi (≥1) → service **thay toàn bộ** items bằng list này (replace-all).
 *   KHÔNG nhận `id` item: thư viện mẫu không bị giỏ hàng/đơn hàng tham chiếu
 *   nên id item đổi cũng vô hại. (Khác ProductOptionItem — chỗ đó phải diff/sync
 *   để giữ id ổn định cho giỏ hàng.)
 */
export class UpdateOptionTemplateDto extends PartialType(
  OmitType(CreateOptionTemplateDto, ['optionTemplateItems'] as const),
) {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'id không hợp lệ' })
  id: string;

  @ApiProperty({
    type: [CreateOptionTemplateItemDto],
    required: false,
    description: 'Gửi để thay toàn bộ items; bỏ trống nếu chỉ sửa field mẫu',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Nếu gửi items thì phải có ít nhất 1' })
  @ArrayMaxSize(50, { message: 'Tối đa 50 item mỗi mẫu' })
  @ValidateNested({ each: true })
  @Type(() => CreateOptionTemplateItemDto)
  optionTemplateItems?: CreateOptionTemplateItemDto[];
}
