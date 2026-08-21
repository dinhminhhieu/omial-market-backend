# .claude/specs — spec kỹ thuật từng phần

Mỗi file `.md` ở đây mô tả **1 service hoặc 1 lib**: vai trò, các file chính,
pattern/quy ước, message contract, trạng thái. Mục đích: Claude (và bạn) đọc
spec để hiểu nhanh, **không phải đọc lại toàn bộ code** mỗi lần.

## Quy ước viết spec
- **Ngắn gọn** — bảng + bullet. Đây là chỉ mục, KHÔNG chép lại code.
- Mỗi spec nên có: **Vai trò · Queue/Endpoint · Bản đồ file · Contract/Pattern · Env · Quy ước · Trạng thái · TODO**.
- Trỏ tới file code bằng đường dẫn để bấm mở nhanh.
- Khi code đổi → **cập nhật spec ngay** (skill `/update-spec`).

## Danh sách spec
| File | Bao phủ | Trạng thái |
| --- | --- | --- |
| [api-gateway.md](api-gateway.md) | `apps/api-gateway` | ✅ đang chạy |
| [auth-service.md](auth-service.md) | `apps/auth-service` | ✅ đang chạy (có Outbox) |
| [product-service.md](product-service.md) | `apps/product-service` | ✅ đang chạy |
| [inventory-service.md](inventory-service.md) | `apps/inventory-service` | ✅ đang chạy |
| [order-service.md](order-service.md) | `apps/order-service` | ✅ đang chạy |
| [notification-service.md](notification-service.md) | `apps/notification-service` | ✅ đang chạy (consumer event, idempotency) |
| [promotion-service.md](promotion-service.md) | `apps/promotion-service` | 📐 chỉ có schema, chưa có app Nest |
| [shared-libs.md](shared-libs.md) | `libs/shared` + `libs/event-contracts` | ✅ |

> Thêm service mới (vd product) → tạo `product-service.md` theo cùng khuôn, rồi
> thêm dòng vào bảng này **và** vào `CLAUDE.md`.
