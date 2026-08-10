import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateBrandDto } from './create-brand.dto';

export class UpdateBrandDto extends PartialType(CreateBrandDto) {
  @ApiProperty({ example: '6f1e2c3a-1b2c-3d4e-5f6a-7b8c9d0e1f2a' })
  @IsUUID('4', { message: 'id không hợp lệ' })
  id: string;
}
