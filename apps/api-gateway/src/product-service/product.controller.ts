import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto, RmqForwarder, Public, Roles } from '@app/shared';
import { ClientProxy } from '@nestjs/microservices';
import { PRODUCT_CLIENT } from '../clients';
import { CreateProductDto, UpdateProductDto } from '@app/event-contracts';
import { PRODUCT_PATTERNS } from '@app/event-contracts/patterns/product-service/product.patterns';

@ApiTags('products')
@Controller('products')
export class ProductController {
  private readonly product: RmqForwarder;
  constructor(@Inject(PRODUCT_CLIENT) productClient: ClientProxy) {
    this.product = new RmqForwarder(productClient, 'product-service');
  }

  @Roles('ADMIN')
  @Post()
  createProduct(@Body() dto: CreateProductDto) {
    return this.product.send(PRODUCT_PATTERNS.CREATE, dto);
  }

  @Public()
  @Get()
  findAllProduct(@Param() query: PaginationQueryDto) {
    return this.product.send(PRODUCT_PATTERNS.FIND_ALL, query);
  }

  @Public()
  @Get(':id')
  findOneProduct(@Param('id') id: string) {
    return this.product.send(PRODUCT_PATTERNS.FIND_ONE, id);
  }

  @Roles('ADMIN')
  @Put(':id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.product.send(PRODUCT_PATTERNS.UPDATE, { ...dto, id });
  }

  @Roles('ADMIN')
  @Delete(':id')
  deleteProduct(@Param('id') id: string) {
    return this.product.send(PRODUCT_PATTERNS.DELETE, id);
  }
}
