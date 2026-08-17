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
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import {
  CreateOptionTemplateDto,
  OptionTemplateResponseDto,
  UpdateOptionTemplateDto,
} from '@app/event-contracts';
import {
  PaginationMetaDto,
  PaginationQueryDto,
  RmqForwarder,
  Roles,
} from '@app/shared';
import { PRODUCT_CLIENT } from '../clients';
import { OPTION_TEMPLATE_PATTERNS } from '@app/event-contracts/patterns/product-service/option-template.patterns';

@ApiTags('option-templates')
@Controller('option-templates')
export class OptionTemplateController {
  private readonly product: RmqForwarder;
  constructor(@Inject(PRODUCT_CLIENT) productClient: ClientProxy) {
    this.product = new RmqForwarder(productClient, 'product-service');
  }

  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Tạo mẫu tùy chọn mới' })
  @ApiCreatedResponse({ type: OptionTemplateResponseDto })
  createOptionTemplate(
    @Body() dto: CreateOptionTemplateDto,
  ): Promise<{ data: OptionTemplateResponseDto; message: string }> {
    return this.product.send(OPTION_TEMPLATE_PATTERNS.CREATE, dto);
  }

  @Roles('ADMIN')
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách mẫu tùy chọn (phân trang)' })
  @ApiOkResponse({ type: OptionTemplateResponseDto })
  findAllOptionTemplate(
    @Query() query: PaginationQueryDto,
  ): Promise<{ items: OptionTemplateResponseDto[]; meta: PaginationMetaDto }> {
    return this.product.send(OPTION_TEMPLATE_PATTERNS.FIND_ALL, query);
  }

  @Roles('ADMIN')
  @Get(':id')
  @ApiOperation({ summary: 'Lấy mẫu tùy chọn theo ID' })
  @ApiOkResponse({ type: OptionTemplateResponseDto })
  findOneOptionTemplate(
    @Param('id') id: string,
  ): Promise<OptionTemplateResponseDto> {
    return this.product.send(OPTION_TEMPLATE_PATTERNS.FIND_ONE, id);
  }

  @Roles('ADMIN')
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật mẫu tùy chọn' })
  @ApiOkResponse({ type: OptionTemplateResponseDto })
  updateOptionTemplate(
    @Param('id') id: string,
    dto: UpdateOptionTemplateDto,
  ): Promise<OptionTemplateResponseDto> {
    return this.product.send(OPTION_TEMPLATE_PATTERNS.UPDATE, { ...dto, id });
  }

  @Roles('ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Xoá mẫu tùy chọn' })
  @ApiOkResponse({ type: OptionTemplateResponseDto })
  deleteOptionTemplate(
    @Param('id') id: string,
  ): Promise<OptionTemplateResponseDto> {
    return this.product.send(OPTION_TEMPLATE_PATTERNS.DELETE, id);
  }
}
