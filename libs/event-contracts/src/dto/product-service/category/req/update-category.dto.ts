import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'id không hợp lệ' })
  id: string;
}
