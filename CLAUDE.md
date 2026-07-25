# CLAUDE.md — bản đồ dự án (đọc file này trước, KHỎI đọc lại toàn bộ code)

> Mục tiêu file này: mỗi session mình nắm nhanh kiến trúc + biết spec chi tiết
> nằm ở đâu, thay vì grep/đọc lại cả repo (tốn token).

## Dự án là gì
`omial-market-backend` — NestJS monorepo (pnpm), đang **migrate REST → microservice** giao tiếp qua **RabbitMQ**. Kế hoạch: [docs/microservice-migration-plan.md](docs/microservice-migration-plan.md).

## Kiến trúc đích
```
Client ─HTTP─► api-gateway ─(RabbitMQ send/emit)─► auth | product | order | inventory
              (REST + Swagger,           (pure microservice, @MessagePattern,
               app HTTP duy nhất)         KHÔNG có HTTP)
```
- **api-gateway**: cửa HTTP duy nhất, facade, không chứa business logic.
- **4 service nội bộ**: pure RMQ microservice, mỗi service 1 queue + 1 Postgres riêng (Prisma 7 + `@prisma/adapter-pg`).
- Auth: JWT **ký ở auth-service**, sẽ **verify ở gateway**.

## Stack
NestJS 11 · pnpm monorepo · RabbitMQ (`@nestjs/microservices` Transport.RMQ) · Prisma 7 (adapter-pg) · JWT (`@nestjs/jwt`, access + refresh) · Redis (`ioredis` — OTP + refresh token) · nodemailer (gửi OTP) · bcryptjs · class-validator.

## Bản đồ thư mục
| Đường dẫn | Là gì |
| --- | --- |
| `apps/api-gateway` | REST gateway |
| `apps/auth-service` | Auth microservice (login, register+OTP, refresh, quên mật khẩu — dùng Redis) |
| `apps/{product,order,inventory}-service` | **Chưa migrate** — vẫn REST scaffolding |
| `libs/shared` | Hạ tầng dùng chung (RMQ options, filter, interceptor, bootstrap, dto…) |
| `libs/event-contracts` | "Hợp đồng" message: patterns + DTO (gateway ↔ service) |
| `docs/` | Kế hoạch + hướng dẫn (narrative) |
| `.claude/specs/` | **Spec kỹ thuật chi tiết từng phần — đọc khi làm phần đó** |

## 📁 Specs chi tiết (đọc file tương ứng khi động vào phần đó)
- [.claude/specs/auth-service.md](.claude/specs/auth-service.md) — auth-service (login, register+OTP, refresh, quên mật khẩu)
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
docker compose up -d postgres-auth rabbitmq redis   # hạ tầng (thêm redis cho OTP)
pnpm db:migrate:auth && pnpm db:seed          # migrate + seed user demo
```
User demo: `demo@omial.dev` / `password123`.

## Trạng thái migrate
| Service | Trạng thái |
| --- | --- |
| api-gateway | ✅ HTTP + client RMQ tới auth (đủ 8 route auth) |
| auth-service | ✅ pure microservice — **login, register+OTP, verify/resend, quên/reset mật khẩu, refresh (rotation), logout** (OTP + refresh token lưu Redis) |
| product / order / inventory | ⬜ chưa migrate (còn REST scaffolding) |
