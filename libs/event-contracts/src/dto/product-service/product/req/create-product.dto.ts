import { emptyToUndefined } from '@app/shared/common/utils/transform.util';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductOptionGroupInputDto } from '../../product-option/req/product-option-group-input.dto';
import { ProductType } from 'apps/product-service/src/generated/prisma/enums';
import { CreateProductAttributeDto } from '../../product-variant/req/create-product-attribute.dto';
import { CreateProductVariantDto } from '../../product-variant/req/create-product-variant.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'Bàn ăn gỗ sồi Omial 6 ghế' })
  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  @MaxLength(200, { message: 'Tên sản phẩm tối đa 200 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    enum: ProductType,
    example: ProductType.OPTION,
    required: false,
    default: ProductType.SIMPLE,
    description:
      'Phân loại: SIMPLE (không option/variant) · OPTION (chỉ +extraPrice) · ' +
      'VARIANT (nhiều SKU). Service phải gác invariant: OPTION không kèm variant & ngược lại.',
  })
  @IsOptional()
  @IsEnum(ProductType, { message: 'type phải là SIMPLE, OPTION hoặc VARIANT' })
  type?: ProductType;

  @ApiProperty({
    example: 'ban-an-go-soi-omial-6-ghe',
    required: false,
    description: 'Không gửi (hoặc gửi rỗng) thì service tự sinh từ name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Slug tối đa 200 ký tự' })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang',
  })
  @Transform(({ value }) => emptyToUndefined(value))
  slug?: string;

  @ApiProperty({
    example: 'BAN-GS-06',
    description: 'Mã SKU — duy nhất (tự động sinh nếu để trống)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'SKU tối đa 50 ký tự' })
  @Transform(({ value }) => value?.trim())
  sku?: string;

  @ApiProperty({
    example: 'https://cdn.omial.dev/products/ban-an-go-soi.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Đường dẫn ảnh đại diện tối đa 500 ký tự' })
  @Transform(({ value }) => emptyToUndefined(value))
  thumbnail?: string;

  @ApiProperty({
    example: ['https://cdn.omial.dev/products/ban-an-1.png'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Tối đa 20 ảnh' })
  @IsString({ each: true })
  @MaxLength(500, { each: true, message: 'Mỗi đường dẫn ảnh tối đa 500 ký tự' })
  images?: string[];

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean({ message: 'enablePrice phải là true/false' })
  enablePrice?: boolean;

  @ApiProperty({ example: 4590000, required: false, default: 0 })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Giá phải là số, tối đa 2 chữ số thập phân' },
  )
  @Min(0, { message: 'Giá không được âm' })
  @Max(9999999999.99, { message: 'Giá vượt giới hạn cho phép' })
  price?: number;

  @ApiProperty({ example: 4990000, required: false })
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

  @ApiProperty({ example: 'Bàn ăn gỗ sồi tự nhiên...', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Mô tả tối đa 5000 ký tự' })
  @Transform(({ value }) => emptyToUndefined(value))
  description?: string;

  @ApiProperty({ example: 'Bàn ăn 6 ghế, gỗ sồi.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Mô tả ngắn tối đa 500 ký tự' })
  @Transform(({ value }) => emptyToUndefined(value))
  shortDescription?: string;

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

  @ApiProperty({ example: 'bộ', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Đơn vị tối đa 50 ký tự' })
  @Transform(({ value }) => emptyToUndefined(value))
  unit?: string;

  @ApiProperty({ example: 45.5, required: false })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 3 },
    { message: 'Cân nặng phải là số, tối đa 3 chữ số thập phân' },
  )
  @Min(0, { message: 'Cân nặng không được âm' })
  weight?: number;

  @ApiProperty({ example: 'kg', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Đơn vị cân nặng tối đa 20 ký tự' })
  @Transform(({ value }) => emptyToUndefined(value))
  weightUnit?: string;

  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'categoryId không hợp lệ' })
  categoryId: string;

  @ApiProperty({
    example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'brandId không hợp lệ' })
  @Transform(({ value }) => emptyToUndefined(value))
  brandId?: string;

  @ApiProperty({
    example: ['6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a'],
    required: false,
    type: [String],
    description: 'Danh sách id nhãn gắn vào sản phẩm (bảng nối ProductLabel)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique({ message: 'labelIds không được trùng nhau' })
  @IsUUID('4', { each: true, message: 'labelIds chứa id không hợp lệ' })
  labelIds?: string[];

  @ApiProperty({
    type: [ProductOptionGroupInputDto],
    required: false,
    description:
      'Các nhóm option (đã tuỳ chỉnh từ mẫu ở FE). Service tạo product + các ' +
      'nhóm này trong 1 transaction. KHÔNG gửi templateId — gửi data cuối cùng.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionGroupInputDto)
  productOptionGroups?: ProductOptionGroupInputDto[];

  @ApiProperty({
    type: [CreateProductAttributeDto],
    required: false,
    description:
      'Danh sách thuộc tính của sản phẩm có biến thể (Dành cho type = VARIANT)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  productAttributes?: CreateProductAttributeDto[];

  @ApiProperty({
    type: [CreateProductVariantDto],
    required: false,
    description: 'Danh sách biến thể của sản phẩm (Dành cho type = VARIANT)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  productVariants?: CreateProductVariantDto[];
}
