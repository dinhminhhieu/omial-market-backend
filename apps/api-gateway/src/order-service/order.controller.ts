import {
  Body,
  Controller,
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
  RmqForwarder,
} from '@app/shared';
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
  create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.order.send(ORDER_PATTERNS.CREATE, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn (filter status + search, phân trang)' })
  @ApiPaginatedResponse(OrderResponseDto)
  findAll(
    @Query() query: FindAllOrdersDto,
  ): Promise<{ data: OrderResponseDto[]; meta: PaginationMetaDto }> {
    return this.order.send(ORDER_PATTERNS.FIND_ALL, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn (kèm items + lịch sử trạng thái)' })
  @ApiOkResponse({ type: OrderResponseDto })
  findOne(@Param('id') id: string): Promise<OrderResponseDto> {
    return this.order.send(ORDER_PATTERNS.FIND_ONE, id);
  }

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
