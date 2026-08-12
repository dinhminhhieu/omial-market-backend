import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateOrderDto,
  FindAllOrdersDto,
  ORDER_PATTERNS,
  OrderResponseDto,
  UpdateOrderStatusDto,
} from '@app/event-contracts';
import { PaginationMetaDto } from '@app/shared';
import { OrderServiceService } from './order-service.service';

@Controller()
export class OrderServiceController {
  constructor(private readonly orderServiceService: OrderServiceService) {}

  @MessagePattern(ORDER_PATTERNS.CREATE)
  async create(@Payload() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.orderServiceService.create(dto);
  }

  @MessagePattern(ORDER_PATTERNS.FIND_ALL)
  async findAll(
    @Payload() dto: FindAllOrdersDto,
  ): Promise<{ data: OrderResponseDto[]; meta: PaginationMetaDto }> {
    return this.orderServiceService.findAll(dto);
  }

  @MessagePattern(ORDER_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string): Promise<OrderResponseDto> {
    return this.orderServiceService.findOne(id);
  }

  @MessagePattern(ORDER_PATTERNS.UPDATE_STATUS)
  async updateStatus(
    @Payload() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.orderServiceService.updateStatus(dto);
  }
}
