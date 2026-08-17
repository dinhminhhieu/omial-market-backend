import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
  AdjustStockDto,
  GetStockDto,
  GetStockMovementsDto,
  INVENTORY_PATTERNS,
  IssueStockDto,
  ReceiveStockDto,
  StockItemResponseDto,
  StockMovementResponseDto,
} from '@app/event-contracts';
import {
  ApiPaginatedResponse,
  PaginationMetaDto,
  RmqForwarder,
  Roles,
} from '@app/shared';
import { INVENTORY_CLIENT } from '../clients';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  private readonly inventory: RmqForwarder;

  constructor(@Inject(INVENTORY_CLIENT) inventoryClient: ClientProxy) {
    this.inventory = new RmqForwarder(inventoryClient, 'inventory-service');
  }

  // POST (không phải GET) vì đây là truy vấn BATCH — body chứa danh sách ref,
  // không nhét được vào query string. Trả 200 vì không tạo tài nguyên gì.
  @Roles('ADMIN')
  @Post('stock/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tra cứu tồn kho theo danh sách ref (batch)' })
  @ApiOkResponse({ type: StockItemResponseDto, isArray: true })
  getStock(@Body() dto: GetStockDto): Promise<StockItemResponseDto[]> {
    return this.inventory.send(INVENTORY_PATTERNS.GET_STOCK, dto);
  }

  @Roles('ADMIN')
  @Post('receive')
  @ApiOperation({ summary: 'Phiếu nhập kho (lần đầu tự tạo StockItem)' })
  @ApiCreatedResponse({ type: StockItemResponseDto })
  receive(@Body() dto: ReceiveStockDto): Promise<StockItemResponseDto> {
    return this.inventory.send(INVENTORY_PATTERNS.RECEIVE, dto);
  }

  @Roles('ADMIN')
  @Post('issue')
  @ApiOperation({
    summary: 'Phiếu xuất kho thủ công (hủy/hỏng, nội bộ, trả NCC)',
  })
  @ApiCreatedResponse({ type: StockItemResponseDto })
  issue(@Body() dto: IssueStockDto): Promise<StockItemResponseDto> {
    return this.inventory.send(INVENTORY_PATTERNS.ISSUE, dto);
  }

  @Roles('ADMIN')
  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Phiếu kiểm kê — gửi số đếm thực tế, service tự tính chênh lệch',
  })
  @ApiOkResponse({ type: StockItemResponseDto })
  adjust(@Body() dto: AdjustStockDto): Promise<StockItemResponseDto> {
    return this.inventory.send(INVENTORY_PATTERNS.ADJUST, dto);
  }

  @Roles('ADMIN')
  @Get('movements')
  @ApiOperation({ summary: 'Sổ cái kho của 1 đơn vị lưu kho (phân trang)' })
  @ApiPaginatedResponse(StockMovementResponseDto)
  getMovements(
    @Query() query: GetStockMovementsDto,
  ): Promise<{ data: StockMovementResponseDto[]; meta: PaginationMetaDto }> {
    return this.inventory.send(INVENTORY_PATTERNS.GET_MOVEMENTS, query);
  }
}
