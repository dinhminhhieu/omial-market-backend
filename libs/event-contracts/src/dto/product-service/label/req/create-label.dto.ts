import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Payload tạo Label — gửi kèm message `PRODUCT_PATTERNS.LABEL_CREATE`.
 *
 * Dùng chung 2 phía: gateway validate `@Body()` khi client POST,
 * product-service validate lại `@Payload()` khi nhận từ RabbitMQ.
 */
export class CreateLabelDto {
  @ApiProperty({ example: 'Hàng mới về' })
  @IsString()
  @IsNotEmpty({ message: 'Tên nhãn không được để trống' })
  @MaxLength(50, { message: 'Tên nhãn tối đa 50 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  /** Màu hiển thị của nhãn, dạng mã hex. Optional (schema cho phép null). */
  @ApiProperty({ example: '#FF5733', required: false })
  @IsOptional()
  @IsHexColor({ message: 'Màu phải là mã hex hợp lệ, ví dụ #FF5733' })
  color?: string;

  /** Bật/tắt nhãn. Không truyền → DB mặc định `true`. */
  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
