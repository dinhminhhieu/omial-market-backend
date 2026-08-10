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
  CreateLabelDto,
  LabelResponseDto,
  UpdateLabelDto,
} from '@app/event-contracts';
import {
  PaginationMetaDto,
  PaginationQueryDto,
  RmqForwarder,
} from '@app/shared';
import { LABEL_PATTERNS } from '@app/event-contracts/patterns/product-service/label.patterns';
import { PRODUCT_CLIENT } from '../clients';

@ApiTags('labels')
@Controller('labels')
export class LabelController {
  private readonly product: RmqForwarder;
  constructor(@Inject(PRODUCT_CLIENT) productClient: ClientProxy) {
    this.product = new RmqForwarder(productClient, 'product-service');
  }

  @Post()
  @ApiOperation({ summary: 'Tạo nhãn mới' })
  @ApiCreatedResponse({ type: LabelResponseDto })
  createLabel(
    @Body() dto: CreateLabelDto,
  ): Promise<{ data: LabelResponseDto; message: string }> {
    return this.product.send(LABEL_PATTERNS.CREATE, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhãn (phân trang)' })
  @ApiOkResponse({ type: LabelResponseDto })
  findAllLabel(
    @Query() query: PaginationQueryDto,
  ): Promise<{ items: LabelResponseDto[]; meta: PaginationMetaDto }> {
    return this.product.send(LABEL_PATTERNS.FIND_ALL, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy nhãn theo ID' })
  @ApiOkResponse({ type: LabelResponseDto })
  findOneLabel(@Param('id') id: string): Promise<LabelResponseDto> {
    return this.product.send(LABEL_PATTERNS.FIND_ONE, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật nhãn' })
  @ApiOkResponse({ type: LabelResponseDto })
  updateLabel(
    @Param('id') id: string,
    dto: UpdateLabelDto,
  ): Promise<LabelResponseDto> {
    return this.product.send(LABEL_PATTERNS.UPDATE, { ...dto, id });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá nhãn hiệu' })
  @ApiOkResponse({ type: LabelResponseDto })
  deleteLabel(@Param('id') id: string): Promise<LabelResponseDto> {
    return this.product.send(LABEL_PATTERNS.DELETE, id);
  }
}
