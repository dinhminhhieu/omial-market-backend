import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { emptyToUndefined } from '@app/shared/common/utils/transform.util';
import { OrderStatus } from '../../../../enums/order-status.enum';

/**
 * Mọi chuyển trạng thái (xác nhận, giao, hoàn tất, HUỶ) đều đi qua đây.
 * Service gác máy trạng thái: chỉ cho phép transition hợp lệ
 * (PENDING→CONFIRMED|CANCELLED, CONFIRMED→SHIPPING|CANCELLED,
 *  SHIPPING→COMPLETED|CANCELLED; COMPLETED/CANCELLED = terminal).
 * Mỗi lần chuyển ghi 1 dòng OrderStatusHistory (append-only) — huỷ thì
 * lý do nằm trong note.
 */
export class UpdateOrderStatusDto {
  @ApiProperty()
  @IsUUID('4', { message: 'id đơn hàng không hợp lệ' })
  id: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.CONFIRMED })
  @IsEnum(OrderStatus, { message: 'Trạng thái không hợp lệ' })
  toStatus: OrderStatus;

  @ApiProperty({ required: false, example: 'Khách gọi huỷ vì đặt nhầm' })
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}

/** Body cho route REST PATCH /orders/:id/status — id lấy từ param, không nằm trong body. */
export class UpdateOrderStatusBodyDto extends OmitType(UpdateOrderStatusDto, [
  'id',
] as const) {}
