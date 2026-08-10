import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateLabelDto } from './create-label.dto';

/**
 * Payload cập nhật Label — `PRODUCT_PATTERNS.LABEL_UPDATE`.
 *
 * `PartialType(CreateLabelDto)` biến mọi field của Create thành optional
 * (client chỉ gửi field muốn đổi), thêm `id` bắt buộc để biết sửa bản ghi nào.
 */
export class UpdateLabelDto extends PartialType(CreateLabelDto) {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'id không hợp lệ' })
  id: string;
}
