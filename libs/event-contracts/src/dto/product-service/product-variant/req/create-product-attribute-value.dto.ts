import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductAttributeValueDto {
  @ApiProperty({
    example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'id giá trị thuộc tính không hợp lệ' })
  id?: string;

  @ApiProperty({ example: 'Đỏ' })
  @IsString()
  @IsNotEmpty({ message: 'Tên giá trị thuộc tính không được để trống' })
  @Transform(({ value }) => value?.trim())
  value: string;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt({ message: 'Vị trí phải là số nguyên' })
  @Min(0, { message: 'Vị trí không được âm' })
  position?: number;
}
