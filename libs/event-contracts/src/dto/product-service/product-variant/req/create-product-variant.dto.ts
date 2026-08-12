import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { VariantAttributeSelectionDto } from './variant-attribute-selection.dto';

export class CreateProductVariantDto {
  @ApiProperty({
    example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'id biến thể không hợp lệ' })
  id?: string;

  @ApiProperty({
    example: 'SKU-AO-DO-S',
    description: 'SKU biến thể — duy nhất (tự động sinh nếu để trống)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'SKU biến thể tối đa 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  sku?: string;

  @ApiProperty({ example: 150000 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Giá niêm yết phải là số, tối đa 2 chữ số thập phân' },
  )
  @Min(0, { message: 'Giá không được âm' })
  @Max(9999999999.99, { message: 'Giá vượt giới hạn cho phép' })
  price: number;

  @ApiProperty({ example: 180000, required: false })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Giá so sánh phải là số, tối đa 2 chữ số thập phân' },
  )
  @Min(0, { message: 'Giá so sánh không được âm' })
  @Max(9999999999.99, { message: 'Giá so sánh vượt giới hạn cho phép' })
  compareAtPrice?: number;

  @ApiProperty({ example: '2026-08-01T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'saleStartAt phải đúng định dạng ISO Date string' },
  )
  saleStartAt?: string;

  @ApiProperty({ example: '2026-08-15T23:59:59Z', required: false })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'saleEndAt phải đúng định dạng ISO Date string' },
  )
  saleEndAt?: string;

  // KHÔNG nhận stock ở đây — tồn kho nhập qua inventory-service (phiếu nhập kho),
  // product-service không sở hữu số tồn.

  @ApiProperty({ example: 'https://example.com/red-s.jpg', required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiProperty({
    type: [VariantAttributeSelectionDto],
    description:
      'Danh sách thuộc tính ứng với biến thể này (Ví dụ: [{ attributeName: "Màu sắc", value: "Đỏ" }])',
    required: false,
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeSelectionDto)
  attributeSelections?: VariantAttributeSelectionDto[];

  @ApiProperty({
    example: ['uuid-value-1', 'uuid-value-2'],
    description:
      'Danh sách ID giá trị thuộc tính (dành cho client gửi ID trực tiếp)',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { each: true, message: 'ID giá trị thuộc tính không hợp lệ' })
  attributeValueIds?: string[];
}
