import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class VariantAttributeSelectionDto {
  @ApiProperty({ example: 'Màu sắc' })
  @IsString()
  @IsNotEmpty({ message: 'Tên thuộc tính không được để trống' })
  @Transform(({ value }) => value?.trim())
  attributeName: string;

  @ApiProperty({ example: 'Đỏ' })
  @IsString()
  @IsNotEmpty({ message: 'Giá trị thuộc tính không được để trống' })
  @Transform(({ value }) => value?.trim())
  value: string;
}
