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
  Public,
  Roles,
} from '@app/shared';
import { PRODUCT_CLIENT } from '../clients';

@ApiTags('brands')
@Controller('brands')
export class BrandController {
  private readonly product: RmqForwarder;

  constructor(@Inject(PRODUCT_CLIENT) productClient: ClientProxy) {
    this.product = new RmqForwarder(productClient, 'product-service');
  }

  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Tạo thương hiệu mới' })
  @ApiCreatedResponse({ type: BrandResponseDto })
  createBrand(
    @Body() dto: CreateBrandDto,
  ): Promise<{ data: BrandResponseDto; message: string }> {
    return this.product.send(BRAND_PATTERNS.CREATE, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thương hiệu (phân trang)' })
  @ApiPaginatedResponse(BrandResponseDto)
  findAllBrand(
    @Query() query: PaginationQueryDto,
  ): Promise<{ items: BrandResponseDto[]; meta: PaginationMetaDto }> {
    return this.product.send(BRAND_PATTERNS.FIND_ALL, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thương hiệu theo ID' })
  @ApiOkResponse({ type: BrandResponseDto })
  findOneBrand(@Param('id') id: string): Promise<BrandResponseDto> {
    return this.product.send(BRAND_PATTERNS.FIND_ONE, id);
  }

  @Roles('ADMIN')
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thương hiệu' })
  @ApiOkResponse({ type: BrandResponseDto })
  updateBrand(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    return this.product.send(BRAND_PATTERNS.UPDATE, { ...dto, id });
  }

  @Roles('ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa thương hiệu' })
  @ApiOkResponse({ type: BrandResponseDto })
  deleteBrand(@Param('id') id: string): Promise<BrandResponseDto> {
    return this.product.send(BRAND_PATTERNS.DELETE, id);
  }
}
