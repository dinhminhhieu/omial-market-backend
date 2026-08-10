# Soft Delete & Data Lifecycle (chiến lược xoá per-entity)

> Note theo khuôn mục 3 roadmap. Quyết định chốt ngày 2026-08-03, migration
> `20260803044232_drop_soft_delete_brand_label_restrict_category_parent`.

## Vấn đề nào buộc phải dùng

- Dữ liệu bị **lịch sử tham chiếu**: đơn hàng trỏ tới product — xoá cứng product
  là đơn cũ của khách thành "sản phẩm không tồn tại".
- Xoá nhầm cần khôi phục được (category là cây điều hướng, gãy là gãy cả menu).
- Ngược lại: dữ liệu **không ai tham chiếu lịch sử** (label, brand) mà cũng bắt
  soft delete thì chỉ ôm cost vô ích → quyết định phải **per-entity**, không có
  chính sách chung toàn hệ thống.

## Bảng quyết định per-entity

| Entity | Chiến lược | Lý do |
| --- | --- | --- |
| Label | **Hard delete** | Tag đi kèm sản phẩm, không giá trị lịch sử. `ProductLabel.labelId` onDelete `Cascade` → dòng gắn kết tự dọn. |
| Brand | **Hard delete** | `Product.brandId` onDelete `SetNull` → sản phẩm tự gỡ brand, tạo lại gắn lại được. UI nên confirm "đang gắn N sản phẩm". |
| Category | **Soft delete** | "Xoá" danh mục thực chất là "ngừng dùng". Cha–con đổi `Cascade` → `Restrict` (xoá từ lá lên, chống bay cả cây). |
| Product, ProductVariant | **Soft delete** | Đơn hàng cũ cần truy xuất + nút "mua lại" cần row tồn tại. |
| Order (Phase 0 sau) | **Status, không có delete** | Huỷ ≠ xoá. Đơn là chứng từ: `CANCELLED`/`REFUNDED`. |
| Stock movement (inventory) | **Append-only** | Như sổ kế toán: sai thì ghi bù, không tẩy. |
| OTP, refresh token | **TTL Redis** | Tự hết hạn = hard delete tự động. |
| User (auth) | **Soft delete + anonymize PII** | Giữ `id` cho FK order, ghi đè email/tên/sđt khi user yêu cầu xoá (Nghị định 13/2023, GDPR). |

## Không có thì hệ thống hỏng thế nào (scenario cụ thể)

- Hard delete product → khách mở lại đơn 3 tháng trước: tên, giá, ảnh sản phẩm
  biến mất → mất niềm tin + không đối soát được khiếu nại.
- (Trước khi đổi Restrict) xoá category cha → `Cascade` cha–con **xoá cả cây con
  cháu im lặng**, user tưởng xoá 1 dòng, mất 15 dòng.
- Xoá cứng user → FK từ order gãy hoặc đơn mồ côi không truy được người mua.

## Cost / đánh đổi

- **Mọi query phải nhớ `isDeleted: false`** — quên 1 chỗ là data "ma" lộ ra.
- **Soft delete + `@unique` cắn nhau**: dòng đã xoá vẫn chiếm `slug`/`sku` →
  tạo mới trùng slug bị chặn khó hiểu. Fix: đổi slug lúc xoá
  (`-deleted-{ts}`) hoặc partial unique index (`WHERE "isDeleted" = false`, raw SQL).
- **`onDelete` trong schema KHÔNG chạy với soft delete** (nó chỉ kích hoạt khi
  DELETE thật) → check "còn con / còn sản phẩm" phải viết trong service;
  `Restrict` ở schema chỉ là lưới an toàn cho purge job / xoá tay sau này.
- **Soft delete không cứu được thống kê**: doanh thu theo danh mục là dữ liệu
  lịch sử — sản phẩm đổi danh mục là số liệu quá khứ "dọn nhà" theo. Giải pháp
  thật là **snapshot vào order_item lúc mua** (làm khi migrate order-service).
- DB phình dần → Phase 2 học cron thì thêm job purge (sọt rác 30 ngày) nếu cần.

## Code tôi đã viết ở đâu

- Schema + quyết định onDelete: `apps/product-service/prisma/schema.prisma`
  (Category.parent `Restrict`, Product.categoryId `Restrict`, Product.brandId
  `SetNull`, ProductLabel `Cascade`).
- Migration: `apps/product-service/prisma/migrations/20260803044232_*`.
- Soft delete + check trước khi xoá: `apps/product-service/src/category/category.service.ts`.
- Hard delete: `apps/product-service/src/label/label.service.ts`, `brand.service.ts`.

## Điều tôi hiểu sai lúc đầu

- Tưởng module nào cũng nên soft delete "cho an toàn" → thực ra soft delete là
  pattern có cost, chỉ dùng khi có lịch sử tham chiếu / cần khôi phục.
- Đọc nhầm `Cascade` ở quan hệ cha–con thành "còn sản phẩm thì không cho xoá"
  — cái chặn đó là `Restrict` ở `Product.categoryId`; còn `Cascade` cha–con
  nguy hiểm (xoá cả cây im lặng) nên đã đổi thành `Restrict`.
- Tưởng soft delete giữ được thống kê theo danh mục → không, phải snapshot tại
  thời điểm mua.
- Tưởng khai báo `onDelete` trong schema là DB tự gác luồng xoá → soft delete
  là UPDATE, rule không chạy, service phải tự check.
