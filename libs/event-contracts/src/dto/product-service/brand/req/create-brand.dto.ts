import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Omial' })
  @IsString()
  @IsNotEmpty({ message: 'Tên thương hiệu không được để trống' })
  @MaxLength(100, { message: 'Tên thương hiệu tối đa 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    example: 'https://cdn.omial.dev/brands/omial.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Đường dẫn logo tối đa 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  logo?: string;

  @ApiProperty({ example: 'Thương hiệu nội thất cao cấp.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Mô tả tối đa 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  description?: string;
}
