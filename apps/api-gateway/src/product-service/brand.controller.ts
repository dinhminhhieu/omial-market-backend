import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
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
  BRAND_PATTERNS,
  BrandResponseDto,
  CreateBrandDto,
  UpdateBrandDto,
} from '@app/event-contracts';
import {
  ApiPaginatedResponse,
  PaginationMetaDto,
  PaginationQueryDto,
  RmqForwarder,
} from '@app/shared';
import { PRODUCT_CLIENT } from '../clients';

@ApiTags('brands')
@Controller('brands')
export class BrandController {
  private readonly product: RmqForwarder;

  constructor(@Inject(PRODUCT_CLIENT) productClient: ClientProxy) {
    this.product = new RmqForwarder(productClient, 'product-service');
  }

  @Post()
  @ApiOperation({ summary: 'Tạo thương hiệu mới' })
  @ApiCreatedResponse({ type: BrandResponseDto })
  createBrand(
    @Body() dto: CreateBrandDto,
  ): Promise<{ data: BrandResponseDto; message: string }> {
    return this.product.send(BRAND_PATTERNS.CREATE, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thương hiệu (phân trang)' })
  @ApiPaginatedResponse(BrandResponseDto)
  findAllBrand(
    @Query() query: PaginationQueryDto,
  ): Promise<{ items: BrandResponseDto[]; meta: PaginationMetaDto }> {
    return this.product.send(BRAND_PATTERNS.FIND_ALL, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thương hiệu theo ID' })
  @ApiOkResponse({ type: BrandResponseDto })
  findOneBrand(@Param('id') id: string): Promise<BrandResponseDto> {
    return this.product.send(BRAND_PATTERNS.FIND_ONE, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thương hiệu' })
  @ApiOkResponse({ type: BrandResponseDto })
  updateBrand(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    return this.product.send(BRAND_PATTERNS.UPDATE, { ...dto, id });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa thương hiệu' })
  @ApiOkResponse({ type: BrandResponseDto })
  deleteBrand(@Param('id') id: string): Promise<BrandResponseDto> {
    return this.product.send(BRAND_PATTERNS.DELETE, id);
  }
}
