import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateOrderDto,
  FindAllOrdersDto,
  ORDER_PATTERNS,
  OrderResponseDto,
  UpdateOrderStatusBodyDto,
} from '@app/event-contracts';
import {
  ApiPaginatedResponse,
  PaginationMetaDto,
  CurrentUser,
  isAdmin,
  RmqForwarder,
  Roles,
} from '@app/shared';
import type { AuthenticatedUser } from '@app/shared';
import { ORDER_CLIENT } from '../clients';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  private readonly order: RmqForwarder;

  constructor(@Inject(ORDER_CLIENT) orderClient: ClientProxy) {
    this.order = new RmqForwarder(orderClient, 'order-service');
  }

  @Post()
  @ApiOperation({
    summary: 'Checkout — tạo đơn (FE chỉ gửi id + số lượng, giá server tính)',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderResponseDto> {
    // customerId ĐÈ bằng giá trị lấy từ JWT — KHÔNG tin field FE gửi lên,
    // nếu không ai cũng đặt đơn đứng tên người khác được.
    return this.order.send(ORDER_PATTERNS.CREATE, {
      ...dto,
      customerId: String(user.sub),
    });
  }

  @Get()
  @ApiOperation({
    summary:
      'Danh sách đơn (Admin xem toàn bộ / lọc theo customerId; Khách tự động lọc theo user.sub)',
  })
  @ApiPaginatedResponse(OrderResponseDto)
  findAll(
    @Query() query: FindAllOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: OrderResponseDto[]; meta: PaginationMetaDto }> {
    const customerId = isAdmin(user) ? query.customerId : String(user.sub);

    return this.order.send(ORDER_PATTERNS.FIND_ALL, {
      ...query,
      customerId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn (kèm items + lịch sử trạng thái)' })
  @ApiOkResponse({ type: OrderResponseDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderResponseDto> {
    const order = await this.order.send<OrderResponseDto>(
      ORDER_PATTERNS.FIND_ONE,
      id,
    );

    if (!isAdmin(user) && order.customerId !== String(user.sub)) {
      throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');
    }

    return order;
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Chuyển trạng thái (kể cả huỷ — lý do ghi vào note)',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusBodyDto,
  ): Promise<OrderResponseDto> {
    return this.order.send(ORDER_PATTERNS.UPDATE_STATUS, { ...dto, id });
  }
}
