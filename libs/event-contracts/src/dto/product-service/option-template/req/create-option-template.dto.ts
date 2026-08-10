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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateOptionTemplateItemDto } from './create-option-template-item.dto';

export class CreateOptionTemplateDto {
  @ApiProperty({ example: 'Nóng/Lạnh', description: 'Tên mẫu — duy nhất' })
  @IsString()
  @IsNotEmpty({ message: 'Tên mẫu không được để trống' })
  @MaxLength(100, { message: 'Tên mẫu tối đa 100 ký tự' })
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

  @ApiProperty({
    type: [CreateOptionTemplateItemDto],
    description: 'Danh sách item của mẫu — tối thiểu 1',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Mẫu phải có ít nhất 1 item' })
  @ArrayMaxSize(50, { message: 'Tối đa 50 item mỗi mẫu' })
  @ValidateNested({ each: true })
  @Type(() => CreateOptionTemplateItemDto)
  optionTemplateItems: CreateOptionTemplateItemDto[];
}
