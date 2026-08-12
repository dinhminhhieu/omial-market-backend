# Spec: promotion-service

**Vai trò (tương lai):** pure RMQ microservice — campaign khuyến mãi (giảm giá / quà tặng / freeship).
**Queue:** `promotion_queue` (chưa khai) · **DB:** `omial_promotion_db` (:5437, docker-compose đang comment).

## Trạng thái
- 📐 **MỚI CHỈ CÓ THIẾT KẾ SCHEMA** ([schema.prisma](../../apps/promotion-service/prisma/schema.prisma), đã `prisma validate`) + prisma.config + .env. **Chưa có app Nest, chưa migration, chưa contracts** — làm sau khi xong Phase 0 (inventory, order, test).
- Quyết định ranh giới: promotion ≠ loyalty (2 domain khác nhau — campaign-driven vs sổ điểm per khách). Loyalty để Phase 2 làm bài event-driven.

## Model — 1 promotion = 5 trục độc lập
| Trục | Ở đâu | Ghi chú |
| --- | --- | --- |
| 1. Lợi ích | `benefitType` + `discountValue`/`maxDiscountAmount` + `PromotionGift[]` | PERCENTAGE (kèm trần) · FIXED_AMOUNT · FREE_SHIPPING · GIFT |
| 2. Phạm vi | `appliesTo` + `PromotionTarget[]` (refType PRODUCT/VARIANT/CATEGORY) | ORDER = tổng đơn, không cần target |
| 3. Điều kiện | `minOrderAmount` · `minQuantity` (đếm TRONG phạm vi) · `firstOrderOnly` | "mua 2 tặng 1" = GIFT + target sp + minQuantity 2 |
| 4. Giới hạn lượt | `maxTotalUses` · `maxUsesPerCustomer` · `usedCount` (cache) + `PromotionCode[]` | sự thật = COUNT(`PromotionUsage`); tăng cache bằng **conditional UPDATE** chống race |
| 5. Lịch | `startAt`/`endAt` + `PromotionTimeWindow[]` (daysOfWeek ISO 1–7, start/endMinute) | nhiều window = OR; đánh giá theo **giờ shop**, không convert UTC trước khi so |

- `visibility` PUBLIC/PRIVATE + `PromotionCustomer[]` (whitelist) — ma trận với code ghi trong schema comment.
- `PromotionUsage` = **sổ cái append-only lần 3** (sau StockMovement): `@@unique([promotionId, orderId])` = idempotency, `discountAmount` = snapshot, FK `Restrict`.
- Xoá: **status-based** (ARCHIVED), KHÔNG hard delete khi đã có usage. Cross-service id = string thường, không FK.
- `isStackable` + `priority`: mặc định không cộng dồn → nhiều promo cùng đậu thì **best-wins** (chọn lợi nhất cho khách). Giảm bậc thang ("mua 3 giảm 5%, mua 5 giảm 10%") = nhiều promotion, best-wins tự chọn mức cao.

## Quà tặng & tồn kho (chốt 2026-08-12)
- **Quà VẪN TRỪ KHO** (mua 1 tặng 1 = trừ 2) — kho đếm cái, không đếm tiền.
- Phân vai: promotion chỉ `evaluate` (không đụng kho) → order-service ghi quà thành
  **order line `unitPrice = 0` + `isGift` + `promotionId`** (snapshot) → inventory
  reserve/trừ theo toàn bộ line, movement vẫn là `SALE` (KHÔNG cần type GIFT riêng —
  truy nguồn qua orderId → line → promotionId).
- `evaluate` nên check `available` của gift qua `inventory.get_stock` trước khi hứa;
  chốt hạ vẫn là reserve atomic ở order flow (hết quà giữa chừng → chặn promo hoặc
  hỏi khách "vẫn mua không quà?" — quyết UX khi làm order).

## Invariant service phải gác (DB không biết)
- PERCENTAGE → `discountValue` 0–100 (bắt buộc) · FIXED_AMOUNT → > 0 · GIFT → ≥1 gift + discountValue null · FREE_SHIPPING → appliesTo = ORDER.
- `appliesTo != ORDER` → ≥1 target · PRIVATE → có whitelist hoặc có code · timeWindow `startMinute < endMinute` · `endAt > startAt`.
- Đơn hàng **snapshot** promotion đã áp (tên + số tiền giảm + quà) — sửa campaign sau không được đổi lịch sử đơn.

## Patterns dự kiến (khi làm contracts)
`promotion.evaluate` (nhận context giỏ: customerId?, isFirstOrder, items[], orderTotal, shippingFee, code? → trả promo đậu + số tiền giảm + quà) · `promotion.apply` (ghi PromotionUsage — gọi khi chốt đơn, idempotent theo orderId) · CRUD campaign · `promotion.find_available` (khách xem promo khả dụng).

## Cắt có chủ đích
Tiered discount trong 1 campaign · combination matrix (stack theo cặp) · lô mã unique hàng loạt (bảng code đã sẵn, chỉ thiếu generator) · budget trần tổng tiền giảm · A/B test · loyalty (service khác, Phase 2).
