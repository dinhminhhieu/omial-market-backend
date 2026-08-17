import { BadRequestException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  startTestDb,
  StartedTestDb,
} from '@app/shared/testing/postgres-container';
import { StockRefType } from '@app/event-contracts';
import { PrismaClient } from '../generated/prisma/client';
import { InventoryService } from './inventory.service';

/**
 * INTEGRATION TEST — Postgres THẬT trong Docker (không mock Prisma).
 *
 * Chứng minh những thứ unit test KHÔNG thể: migration apply sạch, CHECK constraint
 * thật sự chặn, unique index hoạt động, $transaction rollback thật, và bất biến
 * sổ cái `onHand == SUM(movements.delta)` đúng sau chuỗi thao tác thật.
 *
 * Chạy: `pnpm test:int` (cần Docker). ~10s khởi container.
 */
describe('InventoryService (integration)', () => {
  let db: StartedTestDb;
  let prisma: PrismaClient;
  let service: InventoryService;

  const REF = { refType: StockRefType.PRODUCT, refId: 'prod-int-1' };

  beforeAll(async () => {
    db = await startTestDb('apps/inventory-service');
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: db.databaseUrl }),
    });
    service = new InventoryService(prisma as any);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.stop();
  });

  // Sổ cái append-only nên KHÔNG dọn StockMovement giữa các ca; thay vào đó
  // xoá sạch bằng TRUNCATE CASCADE để mỗi ca bắt đầu từ kho rỗng.
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "StockMovement", "StockItem" RESTART IDENTITY CASCADE',
    );
  });

  /** Bất biến sổ cái: cột onHand phải luôn khớp tổng các delta. */
  async function assertLedgerInvariant(stockItemId: string) {
    const item = await prisma.stockItem.findUniqueOrThrow({
      where: { id: stockItemId },
    });
    const agg = await prisma.stockMovement.aggregate({
      where: { stockItemId },
      _sum: { delta: true },
    });
    expect(item.onHand).toBe(agg._sum.delta ?? 0);
  }

  it('receive: tạo StockItem + movement, onHand đúng, và upsert lần 2 thì CỘNG DỒN', async () => {
    const first = await service.receive({
      ...REF,
      sku: 'SKU-INT',
      quantity: 10,
    });
    expect(first.onHand).toBe(10);
    expect(first.available).toBe(10);

    const second = await service.receive({
      ...REF,
      sku: 'SKU-INT',
      quantity: 5,
    });
    expect(second.onHand).toBe(15); // upsert increment, KHÔNG tạo item thứ 2
    expect(second.id).toBe(first.id);

    const count = await prisma.stockItem.count();
    expect(count).toBe(1); // unique (refType, refId) giữ đúng 1 dòng

    await assertLedgerInvariant(first.id);
  });

  it('issue: conditional UPDATE THẬT chặn xuất quá tồn — nghẽn ở tầng DB, không phải mock', async () => {
    const item = await service.receive({ ...REF, sku: 'SKU-INT', quantity: 8 });

    // Xuất 3 → OK
    const afterIssue = await service.issue({
      ...REF,
      quantity: 3,
      reason: 'vỡ 3',
    });
    expect(afterIssue.onHand).toBe(5);

    // Xuất 100 → phải bị chặn (available chỉ còn 5)
    await expect(
      service.issue({ ...REF, quantity: 100, reason: 'xuất lố' }),
    ).rejects.toThrow(BadRequestException);

    // Sổ cái KHÔNG được có dòng ISSUE thất bại đó
    const movements = await prisma.stockMovement.findMany({
      where: { stockItemId: item.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements.map((m) => m.delta)).toEqual([8, -3]);
    await assertLedgerInvariant(item.id);
  });

  it('CHECK constraint reserved <= onHand: DB TỰ chặn ghi dữ liệu vô lý', async () => {
    const item = await service.receive({ ...REF, sku: 'SKU-INT', quantity: 5 });

    // Cố ép reserved (10) > onHand (5) bằng raw SQL → CHECK constraint phải nổ.
    // Đây là thứ chỉ integration test kiểm được: constraint viết trong migration
    // có THẬT SỰ tồn tại trong DB không.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "StockItem" SET "reserved" = 10 WHERE "id" = '${item.id}'`,
      ),
    ).rejects.toThrow(
      /stock_item_reserved_lte_on_hand|violates check constraint/i,
    );
  });

  it('CHECK constraint onHand >= 0: không thể để tồn âm', async () => {
    const item = await service.receive({ ...REF, sku: 'SKU-INT', quantity: 5 });

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "StockItem" SET "onHand" = -1 WHERE "id" = '${item.id}'`,
      ),
    ).rejects.toThrow(/stock_item_on_hand_non_negative|check constraint/i);
  });

  it('unique (refType, refId): 2 lần receive KHÁC sku cùng ref vẫn chỉ 1 StockItem', async () => {
    await service.receive({ ...REF, sku: 'SKU-A', quantity: 2 });
    const again = await service.receive({ ...REF, sku: 'SKU-B', quantity: 3 });

    expect(again.onHand).toBe(5);
    expect(again.sku).toBe('SKU-B'); // update ghi đè bản sao sku
    expect(await prisma.stockItem.count()).toBe(1);
  });

  it('adjust: kiểm kê xuống 3 → ghi ADJUST delta âm, bất biến sổ cái vẫn đúng', async () => {
    const item = await service.receive({
      ...REF,
      sku: 'SKU-INT',
      quantity: 10,
    });

    const adjusted = await service.adjust({
      ...REF,
      actualOnHand: 3,
      reason: 'kiểm kê cuối tháng',
    });
    expect(adjusted.onHand).toBe(3);

    const movements = await prisma.stockMovement.findMany({
      where: { stockItemId: item.id },
    });
    const adjustMovement = movements.find((m) => m.type === 'ADJUST');
    expect(adjustMovement?.delta).toBe(-7); // 3 - 10

    await assertLedgerInvariant(item.id);
  });

  it('getStock batch: trộn ref CÓ và KHÔNG theo dõi tồn → chỉ trả cái có', async () => {
    await service.receive({ ...REF, sku: 'SKU-INT', quantity: 4 });

    const result = await service.getStock({
      refs: [REF, { refType: StockRefType.VARIANT, refId: 'chua-tung-nhap' }],
    });

    expect(result).toHaveLength(1); // ref lạ vắng mặt, không throw
    expect(result[0].refId).toBe('prod-int-1');
  });
});
