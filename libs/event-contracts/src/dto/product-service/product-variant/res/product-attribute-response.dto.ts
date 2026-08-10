import { ApiProperty } from '@nestjs/swagger';

export class ProductAttributeValueResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  value: string;

  @ApiProperty()
  position: number;
}

export class ProductAttributeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  position: number;

  @ApiProperty({ type: [ProductAttributeValueResponseDto] })
  values: ProductAttributeValueResponseDto[];
}
