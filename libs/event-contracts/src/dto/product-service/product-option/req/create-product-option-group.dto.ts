import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProductOptionItemDto } from './create-product-option-item.dto';

export class CreateProductOptionGroupDto {
  @ApiProperty({ example: 'Chất liệu gỗ' })
  @IsString()
  @IsNotEmpty({ message: 'Tên nhóm tuỳ chọn không được để trống' })
  @MaxLength(100, { message: 'Tên nhóm tuỳ chọn tối đa 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    example: 1,
    required: false,
    default: 0,
    description:
      'Số item tối thiểu khách phải chọn (0 = không bắt buộc, >=1 = bắt buộc)',
  })
  @IsOptional()
  @IsInt({ message: 'minSelect phải là số nguyên' })
  @Min(0, { message: 'minSelect không được âm' })
  minSelect?: number;

  @ApiProperty({
    example: 1,
    required: false,
    description:
      'Số item tối đa được chọn (bỏ trống = không giới hạn; 1 = single-select)',
  })
  @IsOptional()
  @IsInt({ message: 'maxSelect phải là số nguyên' })
  @Min(1, { message: 'maxSelect phải >= 1' })
  maxSelect?: number;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt({ message: 'Vị trí phải là số nguyên' })
  @Min(0, { message: 'Vị trí không được âm' })
  position?: number;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'productId không hợp lệ' })
  productId: string;

  @ApiProperty({
    type: [CreateProductOptionItemDto],
    description:
      'Danh sách item tạo kèm — nhóm rỗng thì vô nghĩa nên tối thiểu 1',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Nhóm tuỳ chọn phải có ít nhất 1 item' })
  @ArrayMaxSize(50, { message: 'Tối đa 50 item mỗi nhóm' })
  @ValidateNested({ each: true })
  @Type(() => CreateProductOptionItemDto)
  productOptionItems?: CreateProductOptionItemDto[];
}
