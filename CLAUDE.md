# CLAUDE.md — bản đồ dự án (đọc file này trước, KHỎI đọc lại toàn bộ code)

> Mục tiêu file này: mỗi session mình nắm nhanh kiến trúc + biết spec chi tiết
> nằm ở đâu, thay vì grep/đọc lại cả repo (tốn token).

## Dự án là gì
`omial-market-backend` — NestJS monorepo (pnpm), đang **migrate REST → microservice** giao tiếp qua **RabbitMQ**. Kế hoạch: [docs/microservice-migration-plan.md](docs/microservice-migration-plan.md).

## Kiến trúc đích
```
Client ─HTTP─► api-gateway ─(RabbitMQ send)─► auth | product | order | inventory
                                    auth ─(emit event)─► notification
              (REST + Swagger,           (pure microservice, @MessagePattern,
               app HTTP duy nhất)         KHÔNG có HTTP)
```
- **api-gateway**: cửa HTTP duy nhất, facade, không chứa business logic.
- **4 service nội bộ**: pure RMQ microservice, mỗi service 1 queue + 1 Postgres riêng (Prisma 7 + `@prisma/adapter-pg`).
- Auth: JWT **ký ở auth-service**, **verify ở gateway** (JwtAuthGuard global) — service nội bộ không verify lại.

## Stack
NestJS 11 · pnpm monorepo · RabbitMQ (`@nestjs/microservices` Transport.RMQ) · Prisma 7 (adapter-pg) · JWT (`@nestjs/jwt`, access + refresh) · Redis (`ioredis` — OTP + refresh token) · nodemailer (gửi OTP) · bcryptjs · class-validator.

## Bản đồ thư mục
| Đường dẫn | Là gì |
| --- | --- |
| `apps/api-gateway` | REST gateway |
| `apps/auth-service` | Auth microservice (login, register+OTP, refresh, quên mật khẩu — dùng Redis) |
| `apps/{product,order,inventory}-service` | Pure RMQ microservice (đã migrate xong) |
| `libs/shared` | Hạ tầng dùng chung (RMQ options, filter, interceptor, bootstrap, dto…) |
| `libs/event-contracts` | "Hợp đồng" message: patterns + DTO (gateway ↔ service) |
| `docs/` | Kế hoạch + hướng dẫn (narrative) |
| `.claude/specs/` | **Spec kỹ thuật chi tiết từng phần — đọc khi làm phần đó** |

## 📁 Specs chi tiết (đọc file tương ứng khi động vào phần đó)
- [.claude/specs/auth-service.md](.claude/specs/auth-service.md) — auth-service (login, register+OTP, refresh, quên mật khẩu)
- [.claude/specs/product-service.md](.claude/specs/product-service.md) — product-service (brand, label, category, option-template, product + option/variant)
- [.claude/specs/inventory-service.md](.claude/specs/inventory-service.md) — inventory-service (tồn kho sổ cái: StockItem + StockMovement)
- [.claude/specs/order-service.md](.claude/specs/order-service.md) — order-service (đơn hàng: snapshot + máy trạng thái + luồng create)
- [.claude/specs/notification-service.md](.claude/specs/notification-service.md) — notification-service (consumer EVENT đầu tiên: otp.requested → gửi mail)
- [.claude/specs/notification-service.md](.claude/specs/notification-service.md) — notification-service (consumer EVENT đầu tiên: otp.requested → gửi mail)
- [.claude/specs/promotion-service.md](.claude/specs/promotion-service.md) — promotion-service (📐 mới thiết kế schema, chưa code)
- [.claude/specs/api-gateway.md](.claude/specs/api-gateway.md) — gateway + client RMQ
- [.claude/specs/shared-libs.md](.claude/specs/shared-libs.md) — libs/shared + libs/event-contracts
- [.claude/specs/README.md](.claude/specs/README.md) — quy ước viết spec

## ⚠️ QUY ƯỚC BẮT BUỘC
1. **Trước khi sửa 1 service/lib** → đọc spec tương ứng trong `.claude/specs/` (đừng grep lại cả code).
2. **Sau khi thêm/sửa module, service, tính năng** → cập nhật spec đó (dùng skill `/update-spec`). Nếu thêm service mới → tạo `.claude/specs/<service>.md` + thêm dòng vào bảng "Specs chi tiết" ở trên và cập nhật cột trạng thái.
3. Giữ spec **ngắn gọn, dạng bảng/bullet** — nó là chỉ mục, không phải chép lại code.

## Lệnh hay dùng
```bash
pnpm start:gateway            # chạy gateway (HTTP :3000)
pnpm start:auth               # chạy auth-service (nghe RabbitMQ)
pnpm build                    # build (nest build)
pnpm test                     # 193 unit test (mock Prisma) · pnpm test:cov (ngưỡng 65%)
pnpm test:int                 # integration test — Postgres THẬT qua testcontainers (cần Docker)
docker compose up -d postgres-auth rabbitmq redis   # hạ tầng (thêm redis cho OTP)
pnpm db:migrate:auth && pnpm db:seed          # migrate + seed user demo
```
Tài khoản seed: `demo@omial.dev` (USER) · `admin@omial.dev` (ADMIN) — cùng mật khẩu `password123`.

## 🔐 Bảo mật (Phase 1 — đọc trước khi thêm route mới)
- Gateway có **3 guard global** (đúng thứ tự): `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard`.
  Route mới **mặc định CẦN token**; muốn công khai phải `@Public()`, muốn chỉ admin thì `@Roles('ADMIN')`.
- Chính sách hiện tại: GET sản phẩm/danh mục/nhãn/thương hiệu = `@Public` · mọi thao tác GHI,
  kho, mẫu option, danh sách đơn = `@Roles('ADMIN')` · tạo đơn = user đã đăng nhập.
- **Danh tính lấy từ token, KHÔNG tin body**: gateway đè `customerId` bằng `user.sub` (xem order.controller).
- Message RMQ phải mang header `x-internal-token` (`INTERNAL_SERVICE_TOKEN` trong `.env`) —
  `InternalAuthGuard` trong `CommonModule` chặn mọi message publish thẳng vào queue.

## Trạng thái migrate
| Service | Trạng thái |
| --- | --- |
| api-gateway | ✅ HTTP + client RMQ tới auth (8 route), product (5 resource), inventory (5 route), order (4 route) + module media (presigned upload → MinIO). **Phase 1: JwtAuthGuard + RolesGuard + Throttler + helmet/CORS** |
| auth-service | ✅ pure microservice — **login, register+OTP, verify/resend, quên/reset mật khẩu, refresh (rotation), logout** (OTP + refresh token lưu Redis). **Phase 2: emit `otp.requested` qua OUTBOX** (không publish trực tiếp) |
| notification-service | ✅ pure RMQ **consumer event** — nghe `otp.requested` → gửi mail OTP (MailService chuyển từ auth sang). Chưa có DB (7.4 idempotency sẽ thêm) |
| product-service | ✅ pure microservice — **brand, label, category (cây), option-template, product (SIMPLE/OPTION/VARIANT)**. Variant **không còn cột stock** (tồn kho → inventory). Còn thiếu unit test nghiệp vụ |
| inventory-service | ✅ pure microservice — **sổ cái tồn kho: get_stock (batch), receive, issue (conditional update), adjust (optimistic lock), get_movements** — gateway route + smoke e2e pass + unit test nghiệp vụ (98% lines) |
| order | ✅ pure microservice — **checkout (giá server-side, validate option/tồn qua RMQ service-to-service), máy trạng thái + history, search/phân trang** — gateway route + smoke e2e toàn hệ pass + unit test (87% lines). Chưa reserve kho (Phase 2 saga) |
| notification | ✅ pure RMQ **consumer event** — nghe `otp.requested` → gửi mail OTP (MailService chuyển từ auth sang). Chưa có DB (7.4 idempotency sẽ thêm) |
| promotion | 📐 chỉ mới thiết kế schema (campaign 5 trục + sổ cái usage) — code sau khi xong Phase 0 |
