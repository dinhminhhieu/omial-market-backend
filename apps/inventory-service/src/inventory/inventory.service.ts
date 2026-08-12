import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdjustStockDto,
  GetStockDto,
  GetStockMovementsDto,
  IssueStockDto,
  ReceiveStockDto,
  StockItemResponseDto,
  StockMovementResponseDto,
  StockMovementType,
  StockRefType,
} from '@app/event-contracts';
import { buildPaginationMeta, PaginationMetaDto } from '@app/shared';
import {
  StockRefType as DbStockRefType,
  StockMovementType as DbStockMovementType,
} from '../generated/prisma/enums';
import { StockItem } from '../generated/prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

  private toResponse(item: StockItem): StockItemResponseDto {
    return {
      id: item.id,
      refType: item.refType as StockRefType,
      refId: item.refId,
      sku: item.sku,
      onHand: item.onHand,
      reserved: item.reserved,
      available: item.onHand - item.reserved,
      updatedAt:
        typeof item.updatedAt === 'string'
          ? item.updatedAt
          : item.updatedAt.toISOString(),
    };
  }

  async getStock(dto: GetStockDto): Promise<StockItemResponseDto[]> {
    if (!dto.refs || dto.refs.length === 0) {
      return [];
    }

    const items = await this.prismaService.stockItem.findMany({
      where: {
        OR: dto.refs.map((ref) => ({
          refType: ref.refType as DbStockRefType,
          refId: ref.refId,
        })),
      },
    });

    return items.map((item) => this.toResponse(item));
  }

  async receive(dto: ReceiveStockDto): Promise<StockItemResponseDto> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        // 1. Upsert StockItem: tạo mới nếu chưa có, hoặc tăng số lượng onHand nếu đã có
        const item = await tx.stockItem.upsert({
          where: {
            refType_refId: {
              refType: dto.refType as DbStockRefType,
              refId: dto.refId,
            },
          },
          create: {
            refType: dto.refType as DbStockRefType,
            refId: dto.refId,
            sku: dto.sku,
            onHand: dto.quantity,
            reserved: 0,
          },
          update: {
            sku: dto.sku,
            onHand: {
              increment: dto.quantity,
            },
          },
        });

        // 2. Ghi dòng chứng từ vào sổ cái StockMovement
        await tx.stockMovement.create({
          data: {
            stockItemId: item.id,
            type: DbStockMovementType.RECEIVE,
            delta: dto.quantity,
            reason: dto.reason ?? null,
          },
        });

        return this.toResponse(item);
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException(
          'Mã SKU đã được sử dụng cho sản phẩm/biến thể khác',
        );
      }
      throw error;
    }
  }

  async issue(dto: IssueStockDto): Promise<StockItemResponseDto> {
    return this.prismaService.$transaction(async (tx) => {
      // 1. Tìm StockItem cần xuất kho
      const item = await tx.stockItem.findUnique({
        where: {
          refType_refId: {
            refType: dto.refType as DbStockRefType,
            refId: dto.refId,
          },
        },
      });

      if (!item) {
        throw new NotFoundException(
          'Sản phẩm/Biến thể chưa được khởi tạo tồn kho',
        );
      }

      // 2. Trừ kho atomic bằng $queryRaw với RETURNING * và kiểm tra onHand - reserved >= quantity
      const [updatedItem] = await tx.$queryRaw<StockItem[]>`
        UPDATE "StockItem" SET "onHand" = "onHand" - ${dto.quantity}
        WHERE "id" = ${item.id} AND "onHand" - "reserved" >= ${dto.quantity}
        RETURNING *`;

      if (!updatedItem) {
        throw new BadRequestException('Không đủ tồn khả dụng để xuất');
      }

      // 3. Ghi dòng chứng từ xuất kho vào sổ cái StockMovement
      await tx.stockMovement.create({
        data: {
          stockItemId: item.id,
          type: DbStockMovementType.ISSUE,
          delta: -dto.quantity,
          reason: dto.reason,
        },
      });

      return this.toResponse(updatedItem);
    });
  }

  async adjust(dto: AdjustStockDto): Promise<StockItemResponseDto> {
    return this.prismaService.$transaction(async (tx) => {
      // 1. Tìm StockItem cần kiểm kê
      const item = await tx.stockItem.findUnique({
        where: {
          refType_refId: {
            refType: dto.refType as DbStockRefType,
            refId: dto.refId,
          },
        },
      });

      if (!item) {
        throw new NotFoundException(
          'Sản phẩm/Biến thể chưa được khởi tạo tồn kho',
        );
      }

      // 2. Tính delta = số lượng kiểm kê thực tế - số hiện tại trong kho
      const delta = dto.actualOnHand - item.onHand;

      if (delta === 0) {
        return this.toResponse(item);
      }

      // 3. Optimistic update: Đảm bảo onHand không bị thay đổi bởi giao dịch khác trong khi kiểm kê
      const { count } = await tx.stockItem.updateMany({
        where: { id: item.id, onHand: item.onHand },
        data: { onHand: dto.actualOnHand },
      });

      if (count === 0) {
        throw new ConflictException(
          'Tồn kho vừa thay đổi do giao dịch khác, vui lòng kiểm kê lại',
        );
      }

      // 4. Ghi chứng từ kiểm kê vào sổ cái StockMovement
      await tx.stockMovement.create({
        data: {
          stockItemId: item.id,
          type: DbStockMovementType.ADJUST,
          delta,
          reason: dto.reason,
        },
      });

      const updatedItem = await tx.stockItem.findUniqueOrThrow({
        where: { id: item.id },
      });

      return this.toResponse(updatedItem);
    });
  }

  async getMovements(
    dto: GetStockMovementsDto,
  ): Promise<{ data: StockMovementResponseDto[]; meta: PaginationMetaDto }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      stockItem: {
        refType: dto.refType as DbStockRefType,
        refId: dto.refId,
      },
    };

    const [movements, total] = await Promise.all([
      this.prismaService.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.stockMovement.count({ where }),
    ]);

    return {
      data: movements.map((m) => ({
        id: m.id,
        stockItemId: m.stockItemId,
        type: m.type as StockMovementType,
        delta: m.delta,
        reason: m.reason,
        refType: m.refType,
        refId: m.refId,
        createdAt: m.createdAt.toISOString(),
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
