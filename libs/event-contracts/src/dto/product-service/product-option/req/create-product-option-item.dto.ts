import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Item bên trong 1 nhóm tuỳ chọn. KHÔNG có groupId — khi tạo nested cùng group
 * thì id nhóm lấy từ cha; khi thêm lẻ vào nhóm có sẵn thì dùng AddProductOptionItemDto.
 */
export class CreateProductOptionItemDto {
  @ApiProperty({
    example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'id tuỳ chọn không hợp lệ' })
  id?: string;

  @ApiProperty({ example: 'Gỗ óc chó' })
  @IsString()
  @IsNotEmpty({ message: 'Tên tuỳ chọn không được để trống' })
  @MaxLength(100, { message: 'Tên tuỳ chọn tối đa 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    example: 2000000,
    required: false,
    default: 0,
    description: 'Phụ thu cộng vào giá sản phẩm khi chọn tuỳ chọn này',
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Phụ thu phải là số, tối đa 2 chữ số thập phân' },
  )
  @Min(0, { message: 'Phụ thu không được âm' })
  @Max(9999999999.99, { message: 'Phụ thu vượt giới hạn cho phép' })
  extraPrice?: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái phải là true/false' })
  status?: boolean;

  @ApiProperty({
    example: false,
    required: false,
    default: false,
    description: 'Được tick sẵn khi khách mở sản phẩm',
  })
  @IsOptional()
  @IsBoolean({ message: 'isDefault phải là true/false' })
  isDefault?: boolean;

  @ApiProperty({
    example: 0,
    required: false,
    default: 0,
    description: 'Thứ tự hiển thị trong nhóm (nhỏ đứng trước)',
  })
  @IsOptional()
  @IsInt({ message: 'Vị trí phải là số nguyên' })
  @Min(0, { message: 'Vị trí không được âm' })
  position?: number;
}
