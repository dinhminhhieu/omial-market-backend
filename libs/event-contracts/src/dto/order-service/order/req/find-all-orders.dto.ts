import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { emptyToUndefined } from '@app/shared/common/utils/transform.util';
import { OrderStatus } from '../../../../enums/order-status.enum';

export class FindAllOrdersDto {
  @ApiProperty({ required: false, enum: OrderStatus })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEnum(OrderStatus, { message: 'status không hợp lệ' })
  status?: OrderStatus;

  @ApiProperty({
    required: false,
    description: 'Lọc theo ID khách hàng',
  })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  customerId?: string;

  @ApiProperty({
    required: false,
    description: 'Tìm theo mã đơn / tên / SĐT người nhận',
  })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page tối thiểu là 1' })
  page?: number;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(100, { message: 'limit tối đa là 100' })
  limit?: number;
}
