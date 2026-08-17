# Database per Service

> Note pattern đầu tiên của repo (tiêu chí Phase 0). Viết SAU khi đã migrate đủ
> 4 service — nên mọi hệ quả bên dưới là thứ đã **nếm thật**, không phải lý thuyết.

## Vấn đề nào buộc phải dùng

Mỗi service sở hữu database RIÊNG, service khác **không được** kết nối trực tiếp.
Trong repo: `omial_auth_db` (:5433) · `omial_product_db` (:5434) · `omial_order_db`
(:5435) · `omial_inventory_db` (:5436) — 4 Postgres container tách biệt.

Buộc phải làm vậy vì nếu dùng chung 1 DB:

- **Coupling qua schema**: product-service đổi cột `stock` là order-service gãy,
  dù không ai sửa code order. Ranh giới service trở thành hình thức.
- **Không deploy độc lập được**: 1 migration phải khớp với TẤT CẢ service đang chạy.
- **Không scale riêng được**: kho ghi nhiều (sổ cái append-only), catalog đọc nhiều
  — chung DB thì không tối ưu riêng được.

## Không có thì hệ thống hỏng thế nào

Trước khi tách, `ProductVariant` có cột `stock`. Hệ quả cụ thể đã gặp:

- **Hai nguồn sự thật**: `product.update` sửa thẳng `stock` được → số tồn đổi mà
  KHÔNG có chứng từ nào giải thích → sổ cái kho vỡ bất biến `onHand = SUM(delta)`.
- **Lost update**: nhân viên mở form product (thấy stock 10), trong lúc đó bán 3,
  bấm lưu "10" → ghi đè mất 3 đơn.

Đã sửa bằng migration `drop_variant_stock_move_to_inventory`: tồn kho chỉ còn 1 chủ
sở hữu là inventory-service.

## Cost / đánh đổi — 4 thứ MẤT khi tách DB

| Mất gì | Hệ quả thực tế trong repo | Cách bù |
| --- | --- | --- |
| **JOIN chéo** | Không `JOIN` order ↔ product để lấy tên/giá | Order **snapshot** name/price/option lúc đặt; danh sách tồn thì gọi `inventory.get_stock` **batch** (1 lần cho cả trang, tránh N+1 qua RMQ) |
| **Khoá ngoại (FK)** | `StockItem.refId`, `OrderItem.productId`, `PromotionUsage.orderId` chỉ là `String` | Service tự validate khi ghi; chấp nhận "orphan" (sản phẩm bị xoá mềm vẫn còn trong đơn cũ — mà đó lại ĐÚNG nghiệp vụ) |
| **Transaction xuyên service** | Tạo đơn + trừ kho không thể trong 1 `BEGIN…COMMIT` | Phase 0: chỉ check tồn rồi cho qua (chấp nhận race). Phase 2: **Saga** reserve → commit → release |
| **Truy vấn tổng hợp** | Không thể `GROUP BY` doanh thu theo danh mục bằng 1 câu SQL | Gọi nhiều service rồi ghép ở gateway; lớn hơn thì cần read-model riêng (CQRS, Phase 6) |

Chi phí vận hành cũng nhân lên: 4 migration history, 4 backup, 4 connection pool.

## Code tôi đã viết ở đâu

- `docker-compose.yml` — 4 service Postgres, mỗi cái 1 port + 1 volume riêng.
- `apps/*/prisma/schema.prisma` + `apps/*/.env` — mỗi service 1 `DATABASE_URL`.
- `apps/inventory-service/prisma/schema.prisma:35` — `refId String` (cross-service id, KHÔNG FK).
- `apps/order-service/prisma/schema.prisma` — `OrderItem` snapshot `productName`/`unitPrice`.
- `apps/order-service/src/order-service.service.ts` — `create()` gọi product + inventory
  qua RMQ thay cho JOIN.

## Điều tôi hiểu sai lúc đầu

1. **"Database per service = mỗi khách hàng 1 DB"** — không. Đó là *multi-tenancy*,
   trục hoàn toàn khác (chia theo khách), còn pattern này chia theo *nghiệp vụ*.
   Hai trục vuông góc nhau (xem `docs/adr/001-multi-tenancy-pool-model.md`).
2. **"Tách DB là xong, chỉ cần đổi connection string"** — phần khó không nằm ở hạ
   tầng mà ở **mô hình dữ liệu**: phải quyết chỗ nào tham chiếu (giỏ hàng giữ id để
   hydrate lại) và chỗ nào snapshot (đơn hàng đóng băng giá). Chọn sai là hoặc lịch
   sử bị bóp méo khi giá đổi, hoặc khách bị bắt chọn lại option dù không đổi gì.
3. **"Không có FK thì dữ liệu sẽ loạn"** — thực tế toàn vẹn chuyển từ DB lên
   **service + thiết kế nghiệp vụ**: invariant do service gác (`assertOptionGroupValid`,
   máy trạng thái đơn), còn DB vẫn gác được phần trong phạm vi của mình
   (CHECK `reserved <= onHand`, unique `(refType, refId)`).
