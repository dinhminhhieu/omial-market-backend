import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { emptyToUndefined } from '@app/shared/common/utils/transform.util';
import { CreateOrderItemInputDto } from './create-order-item-input.dto';

export class CreateOrderDto {
  @ApiProperty({
    required: false,
    description:
      'Phase 0: FE gửi tạm (CHƯA tin được). Phase 1: gateway lấy từ JWT, bỏ field này.',
  })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID('4', { message: 'customerId không hợp lệ' })
  customerId?: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  @MaxLength(100, { message: 'Tên người nhận tối đa 100 ký tự' })
  @Transform(({ value }: { value?: string }) => value?.trim())
  customerName: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @Matches(/^[0-9+][0-9 .-]{7,14}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  @Transform(({ value }: { value?: string }) => value?.trim())
  customerPhone: string;

  @ApiProperty({ required: false, example: 'a@gmail.com' })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  customerEmail?: string;

  @ApiProperty({ required: false, example: '123 Lê Lợi, Q1, TP.HCM' })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(500, { message: 'Địa chỉ tối đa 500 ký tự' })
  shippingAddress?: string;

  @ApiProperty({ required: false, example: 'Giao giờ hành chính' })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;

  @ApiProperty({ required: false, default: 'COD', enum: ['COD'] })
  @IsOptional()
  @IsIn(['COD'], { message: 'Phase 0 chỉ hỗ trợ COD' })
  paymentMethod?: string;

  @ApiProperty({ type: [CreateOrderItemInputDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Đơn hàng phải có ít nhất 1 sản phẩm' })
  @ArrayMaxSize(50, { message: 'Tối đa 50 dòng mỗi đơn' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemInputDto)
  items: CreateOrderItemInputDto[];
}
