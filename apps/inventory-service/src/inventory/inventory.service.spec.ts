import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { StockRefType } from '@app/event-contracts';

// Unit test = test LOGIC của service với DB giả — không đụng Postgres thật.
// $transaction được mock thành "gọi thẳng callback với chính prismaMock làm tx".
const makePrismaMock = () => {
  const prisma: any = {
    stockItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn((cb: (tx: any) => any) => cb(prisma));
  return prisma;
};

const stockRow = (over: Partial<any> = {}) => ({
  id: 'stock-1',
  refType: 'PRODUCT',
  refId: 'prod-1',
  sku: 'SKU-1',
  onHand: 10,
  reserved: 0,
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  ...over,
});

describe('InventoryService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: InventoryService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new InventoryService(prisma);
  });

  describe('getStock', () => {
    it('trả mảng rỗng khi refs rỗng, KHÔNG query DB', async () => {
      const result = await service.getStock({ refs: [] });
      expect(result).toEqual([]);
      expect(prisma.stockItem.findMany).not.toHaveBeenCalled();
    });

    it('map available = onHand - reserved (derived, không có trong DB)', async () => {
      prisma.stockItem.findMany.mockResolvedValue([
        stockRow({ onHand: 10, reserved: 3 }),
      ]);
      const result = await service.getStock({
        refs: [{ refType: StockRefType.PRODUCT, refId: 'prod-1' }],
      });
      expect(result[0].available).toBe(7);
    });
  });

  describe('receive', () => {
    it('upsert theo cặp (refType, refId) + ghi movement RECEIVE cùng transaction', async () => {
      prisma.stockItem.upsert.mockResolvedValue(stockRow({ onHand: 15 }));
      prisma.stockMovement.create.mockResolvedValue({});

      const result = await service.receive({
        refType: StockRefType.PRODUCT,
        refId: 'prod-1',
        sku: 'SKU-1',
        quantity: 5,
      });

      expect(prisma.stockItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { refType_refId: { refType: 'PRODUCT', refId: 'prod-1' } },
          update: expect.objectContaining({ onHand: { increment: 5 } }),
        }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'RECEIVE', delta: 5 }),
      });
      expect(result.onHand).toBe(15);
    });

    it('SKU trùng của đơn vị khác (P2002) → BadRequest tiếng người', async () => {
      prisma.stockItem.upsert.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.receive({
          refType: StockRefType.VARIANT,
          refId: 'var-1',
          sku: 'SKU-1',
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('issue', () => {
    const dto = {
      refType: StockRefType.PRODUCT,
      refId: 'prod-1',
      quantity: 3,
      reason: 'vỡ 3',
    };

    it('chưa theo dõi tồn → NotFound', async () => {
      prisma.stockItem.findUnique.mockResolvedValue(null);
      await expect(service.issue(dto)).rejects.toThrow(NotFoundException);
    });

    it('trừ kho qua conditional UPDATE + movement ISSUE delta ÂM', async () => {
      prisma.stockItem.findUnique.mockResolvedValue(stockRow({ onHand: 10 }));
      prisma.$queryRaw.mockResolvedValue([stockRow({ onHand: 7 })]);
      prisma.stockMovement.create.mockResolvedValue({});

      const result = await service.issue(dto);

      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'ISSUE', delta: -3 }),
      });
      expect(result.onHand).toBe(7);
    });

    it('không đủ available (UPDATE trả 0 dòng) → BadRequest, KHÔNG ghi movement', async () => {
      prisma.stockItem.findUnique.mockResolvedValue(stockRow({ onHand: 2 }));
      prisma.$queryRaw.mockResolvedValue([]); // điều kiện onHand - reserved >= qty fail

      await expect(service.issue(dto)).rejects.toThrow(/Không đủ tồn khả dụng/);
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    const dto = {
      refType: StockRefType.PRODUCT,
      refId: 'prod-1',
      actualOnHand: 7,
      reason: 'kiểm kê',
    };

    it('chưa theo dõi tồn → NotFound', async () => {
      prisma.stockItem.findUnique.mockResolvedValue(null);
      await expect(service.adjust(dto)).rejects.toThrow(NotFoundException);
    });

    it('tính delta = thực tế - hệ thống, ghi movement ADJUST', async () => {
      prisma.stockItem.findUnique.mockResolvedValue(stockRow({ onHand: 10 }));
      prisma.stockItem.updateMany.mockResolvedValue({ count: 1 });
      prisma.stockMovement.create.mockResolvedValue({});
      prisma.stockItem.findUniqueOrThrow.mockResolvedValue(
        stockRow({ onHand: 7 }),
      );

      const result = await service.adjust(dto);

      expect(prisma.stockItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'stock-1', onHand: 10 }, // optimistic: khớp onHand cũ mới được ghi
        data: { onHand: 7 },
      });
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'ADJUST', delta: -3 }),
      });
      expect(result.onHand).toBe(7);
    });

    it('kiểm kê KHỚP (delta 0) → trả hiện trạng, KHÔNG ghi gì', async () => {
      prisma.stockItem.findUnique.mockResolvedValue(stockRow({ onHand: 7 }));

      const result = await service.adjust(dto);

      expect(result.onHand).toBe(7);
      expect(prisma.stockItem.updateMany).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('tồn bị giao dịch khác đổi giữa chừng (optimistic lock fail) → Conflict', async () => {
      prisma.stockItem.findUnique.mockResolvedValue(stockRow({ onHand: 10 }));
      prisma.stockItem.updateMany.mockResolvedValue({ count: 0 }); // ai đó vừa sửa onHand

      await expect(service.adjust(dto)).rejects.toThrow(ConflictException);
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('getMovements', () => {
    it('phân trang mới nhất trước + lọc qua relation (không cần tra StockItem trước)', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([
        {
          id: 'm1',
          stockItemId: 'stock-1',
          type: 'RECEIVE',
          delta: 10,
          reason: null,
          refType: null,
          refId: null,
          createdAt: new Date('2026-08-12'),
        },
      ]);
      prisma.stockMovement.count.mockResolvedValue(41);

      const result = await service.getMovements({
        refType: StockRefType.PRODUCT,
        refId: 'prod-1',
        page: 2,
        limit: 20,
      });

      expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stockItem: { refType: 'PRODUCT', refId: 'prod-1' } },
          orderBy: { createdAt: 'desc' },
          skip: 20,
          take: 20,
        }),
      );
      expect(result.data[0].delta).toBe(10);
      expect(result.meta.totalResults).toBe(41);
      expect(result.meta.totalPage).toBe(3);
    });
  });
});
