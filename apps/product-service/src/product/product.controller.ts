import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from '@app/event-contracts';
import { PaginationQueryDto } from '@app/shared';
import { PRODUCT_PATTERNS } from '@app/event-contracts/patterns/product-service/product.patterns';

@Controller()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @MessagePattern(PRODUCT_PATTERNS.CREATE)
  create(@Payload() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @MessagePattern(PRODUCT_PATTERNS.FIND_ALL)
  findAll(@Payload() query: PaginationQueryDto) {
    return this.productService.findAll(query);
  }

  @MessagePattern(PRODUCT_PATTERNS.FIND_ONE)
  findOne(@Payload() id: string) {
    return this.productService.findOne(id);
  }

  @MessagePattern(PRODUCT_PATTERNS.UPDATE)
  update(@Payload() dto: UpdateProductDto) {
    return this.productService.update(dto);
  }

  @MessagePattern(PRODUCT_PATTERNS.DELETE)
  delete(@Payload() id: string) {
    return this.productService.delete(id);
  }
}
