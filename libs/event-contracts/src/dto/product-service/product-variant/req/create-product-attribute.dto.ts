import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProductAttributeValueDto } from './create-product-attribute-value.dto';

export class CreateProductAttributeDto {
  @ApiProperty({
    example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'id thuộc tính không hợp lệ' })
  id?: string;

  @ApiProperty({ example: 'Màu sắc' })
  @IsString()
  @IsNotEmpty({ message: 'Tên thuộc tính không được để trống' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt({ message: 'Vị trí phải là số nguyên' })
  @Min(0, { message: 'Vị trí không được âm' })
  position?: number;

  @ApiProperty({
    type: [CreateProductAttributeValueDto],
    description: 'Danh sách giá trị của thuộc tính (Ví dụ: Đỏ, Xanh, Vàng)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Thuộc tính phải có ít nhất 1 giá trị' })
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeValueDto)
  values: CreateProductAttributeValueDto[];
}
