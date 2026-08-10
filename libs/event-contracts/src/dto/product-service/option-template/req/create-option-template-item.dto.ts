import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Item bên trong 1 mẫu option. KHÔNG có `status` (trạng thái bật/tắt là chuyện
 * của bản sao trong từng sản phẩm — ProductOptionItem, không phải của mẫu gốc).
 */
export class CreateOptionTemplateItemDto {
  @ApiProperty({ example: 'Nóng' })
  @IsString()
  @IsNotEmpty({ message: 'Tên item không được để trống' })
  @MaxLength(100, { message: 'Tên item tối đa 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Phụ thu phải là số, tối đa 2 chữ số thập phân' },
  )
  @Min(0, { message: 'Phụ thu không được âm' })
  @Max(9999999999.99, { message: 'Phụ thu vượt giới hạn cho phép' })
  extraPrice?: number;

  @ApiProperty({
    example: false,
    required: false,
    default: false,
    description: 'Được tick sẵn khi khách mở sản phẩm',
  })
  @IsOptional()
  @IsBoolean({ message: 'isDefault phải là true/false' })
  isDefault?: boolean;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt({ message: 'Vị trí phải là số nguyên' })
  @Min(0, { message: 'Vị trí không được âm' })
  position?: number;
}
