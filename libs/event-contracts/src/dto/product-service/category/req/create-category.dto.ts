import { emptyToUndefined } from '@app/shared/common/utils/transform.util';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Bàn ăn' })
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  @MaxLength(100, { message: 'Tên danh mục tối đa 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    example: 'ban-an',
    required: false,
    description: 'Không gửi (hoặc gửi rỗng) thì service tự sinh từ name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Slug tối đa 100 ký tự' })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang (vd: ban-an)',
  })
  @Transform(({ value }) => emptyToUndefined(value))
  slug?: string;

  @ApiProperty({
    example: 'https://cdn.omial.dev/categories/ban-an.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Đường dẫn ảnh tối đa 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  imageUrl?: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái phải là true/false' })
  status?: boolean;

  @ApiProperty({
    example: 0,
    required: false,
    default: 0,
    description: 'Số càng lớn hiển thị càng trước',
  })
  @IsOptional()
  @IsInt({ message: 'Độ ưu tiên phải là số nguyên' })
  @Min(0, { message: 'Độ ưu tiên không được âm' })
  priority?: number;

  @ApiProperty({ example: 'Các loại bàn ăn gia đình.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Mô tả tối đa 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    required: false,
    description:
      'ID danh mục cha — không gửi (hoặc gửi rỗng) nếu là danh mục gốc',
  })
  @IsOptional()
  @IsUUID('4', { message: 'parentId không hợp lệ' })
  @Transform(({ value }) => emptyToUndefined(value))
  parentId?: string;
}
