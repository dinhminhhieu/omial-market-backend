# Spec: inventory-service

**Vai trò:** pure RMQ microservice — quản lý TỒN KHO theo mô hình **sổ cái append-only**.
Là **single source of truth về số tồn** (product-service KHÔNG còn cột `stock`).
**Queue:** `RMQ_INVENTORY_QUEUE` (`inventory_queue`) · **DB:** Postgres riêng `omial_inventory_db` (:5436).

## Trạng thái
- ✅ Schema + migration (`init_stock`, kèm CHECK constraints) + contracts (patterns + DTO).
- ✅ Service + controller + main.ts (pure RMQ, user tự code): 4 handler đủ, root module
  `InventoryServiceModule` (Common + Prisma + Inventory). Điểm hay trong code:
  `receive` upsert + catch P2002 (SKU thuộc đơn vị khác) · `adjust` **optimistic lock**
  (`updateMany` where `onHand` cũ, count 0 → `ConflictException`) + delta 0 trả im lặng
  · `get_movements` envelope `{data, meta}` chuẩn nhà · `toResponse` tách riêng, không `any`.
- ✅ Gateway route `/inventory/*` (5 route, xem [api-gateway.md](api-gateway.md)) — smoke test e2e pass (receive → issue → get_stock → adjust → movements + ca lỗi 400/404, chặn xuất lố OK).
- ✅ `issue()` — `$queryRaw` conditional UPDATE + `RETURNING *`, điều kiện `onHand - reserved >= qty`.
  ⚠️ Raw UPDATE **bypass `@updatedAt` của Prisma** (nó là magic phía client, không phải trigger DB) → nhớ set `"updatedAt" = now()` ngay trong câu SQL.
- ⬜ Unit test nghiệp vụ (mới có scaffold "should be defined" + mock PrismaService).
- ⬜ Phase 2: `StockReservation` + reserve/release/commit (saga với order-service).

## Model (prisma/schema.prisma)
| Model | Vai trò | Điểm chú ý |
| --- | --- | --- |
| `StockItem` | Tồn HIỆN TẠI của 1 đơn vị lưu kho | `@@unique([refType, refId])` (mốc upsert idempotent) + `sku @unique` (bản sao tra cứu). `onHand` / `reserved`; **`available = onHand − reserved` là DERIVED — số cho khách xem, service tự tính** |
| `StockMovement` | Sổ cái append-only | `delta` CÓ DẤU (+nhập/−xuất). Chỉ INSERT — không updatedAt, không isDeleted, không bao giờ UPDATE/DELETE. Ghi sai → ghi dòng ADJUST bù |

- **Bất biến sổ cái: `onHand == SUM(movements.delta)`** — cột chỉ là cache; lệch = bug.
- `refType` (`PRODUCT` \| `VARIANT`) + `refId` = id bên product-service — **string thường, KHÔNG FK** (khác DB). Option item KHÔNG có tồn kho (chỉ có nút bật/tắt `status` bên product).
- **CHECK constraints thêm tay trong migration SQL** (Prisma schema không khai được): `onHand >= 0`, `reserved >= 0`, `reserved <= onHand`, `delta <> 0`.
- Không có StockItem = "không theo dõi tồn"; `receive` lần đầu tự upsert.

## Message patterns ([inventory.patterns.ts](../../libs/event-contracts/src/patterns/inventory-service/inventory.patterns.ts))
| Pattern | DTO req → res | Nghiệp vụ |
| --- | --- | --- |
| `inventory.get_stock` | `GetStockDto` → `StockItemResponseDto[]` | **BATCH** (tối đa 200 ref) — tránh N+1 qua RMQ. Ref chưa theo dõi tồn thì vắng mặt trong kết quả |
| `inventory.receive` | `ReceiveStockDto` → `StockItemResponseDto` | Phiếu nhập: upsert StockItem (cần `sku`) + movement `RECEIVE` + tăng `onHand` — trong `$transaction` |
| `inventory.issue` | `IssueStockDto` → `StockItemResponseDto` | Phiếu XUẤT tay (hủy/nội bộ/trả NCC): nhận quantity DƯƠNG + `reason` bắt buộc → movement `ISSUE` delta âm. Trừ kho bằng **conditional UPDATE `$executeRaw`** điều kiện `onHand - reserved >= qty` (available, KHÔNG phải onHand — hàng đã giữ chỗ là có chủ); affected 0 → BadRequest. ⚠️ KHÔNG dùng cho xuất bán (SALE tự động, Phase 2) |
| `inventory.adjust` | `AdjustStockDto` → `StockItemResponseDto` | Phiếu kiểm kê: nhận **`actualOnHand` (số đếm thực tế, KHÔNG nhận delta)** + `reason` bắt buộc → service tính `delta = actual − onHand`, ghi movement `ADJUST` |
| `inventory.get_movements` | `GetStockMovementsDto` → `{ data: StockMovementResponseDto[]; meta: PaginationMetaDto }` (envelope chuẩn nhà, meta ở `@app/shared`) | Xem sổ cái 1 đơn vị, phân trang, mới nhất trước |

## Quyết định nghiệp vụ (đọc trước khi sửa!)
- **Không API nào set thẳng `onHand`** — mọi biến động đi qua "chứng từ" (movement). UI "sửa nhanh số tồn" = phiếu kiểm kê trá hình.
- **Chống oversell 2 tầng** (dùng khi làm reserve/SALE ở Phase 2): conditional UPDATE nguyên tử (`... SET reserved = reserved + n WHERE on_hand - reserved >= n`, affected = 0 → hết hàng) + CHECK constraint làm lưới cuối.
- **Reserve khi ĐẶT, trừ thật (SALE) khi HOÀN TẤT, release khi hủy/hết hạn** — khách xem `available`, không xem `onHand`. Phase 2 mới code, model đã chừa chỗ.
- Enum `StockRefType`/`StockMovementType` **mirror 2 nơi**: schema.prisma + [stock.enum.ts](../../libs/event-contracts/src/enums/stock.enum.ts) (contracts không import Prisma generated — như ProductType).
- Cắt có chủ đích (KHÔNG làm ở repo học): giá vốn/COGS trên phiếu nhập, multi-kho (`locationId`), người lập phiếu (`createdBy` — chờ envelope RMQ mang user context), phiếu nhiều dòng (header + lines), kho nguyên liệu/recipe-BOM cho F&B.

## Hạ tầng
- `docker compose up -d postgres-inventory` (:5436) · `pnpm db:migrate:inventory` (deploy) · `pnpm start:inventory`.
- Generator: `moduleFormat = "cjs"` + `runtime = "nodejs"`, output `src/generated/prisma` (chuẩn chung, chống bẫy Jest ESM).
