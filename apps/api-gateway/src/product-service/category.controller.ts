import {
  PaginationMetaDto,
  PaginationQueryDto,
  RmqForwarder,
  Public,
  Roles,
} from '@app/shared';
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
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { CategoryResponseDto, CreateCategoryDto } from '@app/event-contracts';
import { CATEGORY_PATTERNS } from '@app/event-contracts/patterns/product-service/category.patterns';
import { PRODUCT_CLIENT } from '../clients';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  private readonly product: RmqForwarder;
  constructor(@Inject(PRODUCT_CLIENT) productClient: ClientProxy) {
    this.product = new RmqForwarder(productClient, 'product-service');
  }

  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Tạo danh mục mới' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  createCategory(
    @Body() dto: CreateCategoryDto,
  ): Promise<{ data: CategoryResponseDto; message: string }> {
    return this.product.send(CATEGORY_PATTERNS.CREATE, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách danh mục (phân trang)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  findAllCategory(@Param() query: PaginationQueryDto): Promise<{
    items: CategoryResponseDto[];
    meta: PaginationMetaDto;
  }> {
    return this.product.send(CATEGORY_PATTERNS.FIND_ALL, query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy danh mục theo ID' })
  @ApiOkResponse({ type: CategoryResponseDto })
  findOneCategory(@Param('id') id: string): Promise<CategoryResponseDto> {
    return this.product.send(CATEGORY_PATTERNS.FIND_ONE, id);
  }

  @Roles('ADMIN')
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật danh mục' })
  @ApiOkResponse({ type: CategoryResponseDto })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.product.send(CATEGORY_PATTERNS.UPDATE, { id, ...dto });
  }

  @Roles('ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa danh mục' })
  @ApiOkResponse({ type: CategoryResponseDto })
  deleteCategory(@Param('id') id: string): Promise<CategoryResponseDto> {
    return this.product.send(CATEGORY_PATTERNS.DELETE, id);
  }
}
