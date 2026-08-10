import { OmitType } from '@nestjs/swagger';
import { CreateProductOptionGroupDto } from './create-product-option-group.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class ProductOptionGroupInputDto extends OmitType(
  CreateProductOptionGroupDto,
  ['productId'] as const,
) {
  @ApiProperty({
    example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'id nhóm tuỳ chọn không hợp lệ' })
  id?: string;
}
