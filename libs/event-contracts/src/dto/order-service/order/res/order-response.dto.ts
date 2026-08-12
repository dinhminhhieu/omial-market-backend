import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../../../enums/order-status.enum';

export class OrderItemOptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'id ProductOptionItem gốc (tham chiếu)' })
  optionItemId: string;

  @ApiProperty({ example: 'Topping' })
  groupName: string;

  @ApiProperty({ example: 'Trân châu đường đen' })
  itemName: string;

  @ApiProperty({ example: 7000 })
  extraPrice: number;
}

export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({ required: false, nullable: true })
  variantId?: string | null;

  @ApiProperty()
  sku: string;

  @ApiProperty({ description: 'SNAPSHOT lúc đặt — không đổi theo product' })
  productName: string;

  @ApiProperty({ required: false, nullable: true, example: 'Đỏ / S' })
  variantName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  imageUrl?: string | null;

  @ApiProperty({ description: 'Giá 1 đơn vị đã gồm option (snapshot)' })
  unitPrice: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  lineTotal: number;

  @ApiProperty({ description: 'Quà khuyến mãi (unitPrice = 0, kho vẫn trừ)' })
  isGift: boolean;

  @ApiProperty({ type: [OrderItemOptionResponseDto] })
  options: OrderItemOptionResponseDto[];
}

export class OrderStatusHistoryResponseDto {
  @ApiProperty({ required: false, nullable: true, enum: OrderStatus })
  fromStatus?: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus })
  toStatus: OrderStatus;

  @ApiProperty({ required: false, nullable: true })
  note?: string | null;

  @ApiProperty()
  createdAt: Date | string;
}

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'ORD-260812-A1B2' })
  code: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ required: false, nullable: true })
  customerId?: string | null;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  customerPhone: string;

  @ApiProperty({ required: false, nullable: true })
  customerEmail?: string | null;

  @ApiProperty({ required: false, nullable: true })
  shippingAddress?: string | null;

  @ApiProperty({ required: false, nullable: true })
  note?: string | null;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  shippingFee: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  total: number;

  @ApiProperty({ example: 'COD' })
  paymentMethod: string;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ type: [OrderStatusHistoryResponseDto] })
  statusHistory: OrderStatusHistoryResponseDto[];

  @ApiProperty()
  createdAt: Date | string;

  @ApiProperty()
  updatedAt: Date | string;
}
