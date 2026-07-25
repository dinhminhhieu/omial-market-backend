# Hướng dẫn: tính năng Login theo kiến trúc Microservice

> Tài liệu cho người mới. Giải thích **cách tổ chức code** + **cách chạy thử**
> tính năng login đầu tiên (gateway REST ↔ auth-service qua RabbitMQ).

---

## 1. Toàn cảnh: một request login đi qua đâu?

```
  Client (Postman / curl)
      │  POST /api/auth/login   { email, password }   (HTTP)
      ▼
 ┌─────────────────┐
 │   api-gateway   │  app HTTP DUY NHẤT (có Swagger). Không chứa logic.
 │  AuthController │
 └────────┬────────┘
          │  client.send('auth.login', dto)   ← gửi message, CHỜ trả lời (RPC)
          ▼  qua RabbitMQ queue "auth_queue"
 ┌─────────────────┐
 │  auth-service   │  pure microservice (KHÔNG có HTTP), chỉ nghe RabbitMQ.
 │  @MessagePattern('auth.login')
 │   → kiểm password (bcrypt) → ký JWT (jwt)
 └────────┬────────┘
          │  Prisma
          ▼
     postgres-auth   (bảng "User")
```

Kết quả (JWT + user) chạy ngược đúng đường về gateway → gateway bọc envelope
chuẩn → trả HTTP 200 cho client.

**Ý tưởng cốt lõi:** gateway và service KHÔNG gọi HTTP trực tiếp nhau. Chúng
gửi **message** qua RabbitMQ (như bỏ thư qua bưu điện). Nhờ vậy service nội bộ
không cần lộ cổng HTTP ra ngoài.

---

## 2. Các file đã thêm/sửa và vai trò

### `libs/event-contracts` — "hợp đồng" 2 bên phải khớp
| File | Vai trò |
| --- | --- |
| `patterns/auth.patterns.ts` | Hằng `AUTH_PATTERNS.LOGIN = 'auth.login'`. Gateway `send()` và service `@MessagePattern()` dùng chung → không gõ lệch chuỗi. |
| `dto/auth/login.dto.ts` | `LoginDto` (email, password) + rule validate. |
| `dto/auth/login-response.dto.ts` | `LoginResponseDto` (accessToken + user). |

> Đây là "ngôn ngữ chung". Đổi 1 chỗ, cả 2 bên cùng thấy → an toàn.

### `libs/shared` — hạ tầng dùng chung
| File | Vai trò |
| --- | --- |
| `config/rmq.options.ts` | `rmqClientOptions(queue)` / `rmqServerOptions(queue)` — cấu hình RabbitMQ, khỏi lặp. |
| `bootstrap/setup-microservice.ts` | `setupMicroservice(app)` — bản microservice của `setupApp` (chỉ gắn ValidationPipe). |
| `filters/all-exceptions.filter.ts` | **Sửa**: thêm nhánh RPC. Trước đây luôn `switchToHttp()` → vỡ trong microservice. Nay lỗi trong service được đóng gói `{statusCode,message}` gửi ngược về gateway. |

### `apps/auth-service` — chuyển thành pure microservice
| File | Vai trò |
| --- | --- |
| `main.ts` | **Sửa**: `NestFactory.createMicroservice(...)` thay cho `.create()`. Nghe queue `auth_queue`, không mở HTTP. |
| `auth/auth.controller.ts` | `@MessagePattern(AUTH_PATTERNS.LOGIN)` — thay cho `@Post()`. |
| `auth/auth.service.ts` | Logic login: tìm user → `bcrypt.compare` → ký JWT. |
| `auth/auth.module.ts` | Gom controller + service + `JwtModule` + `PrismaModule`. |
| `prisma/prisma.service.ts` | **Sửa**: dùng driver adapter `@prisma/adapter-pg` (Prisma 7). |

### `apps/api-gateway` — REST facade
| File | Vai trò |
| --- | --- |
| `main.ts` | **Sửa**: nạp env (RABBITMQ_URL). Vẫn HTTP + Swagger. |
| `api-gateway.module.ts` | **Sửa**: `ClientsModule` đăng ký `AUTH_CLIENT` trỏ tới `auth_queue`. |
| `auth/auth.controller.ts` | `POST /auth/login` → `client.send('auth.login', dto)`, map lỗi RPC → HttpException. |
| `clients.ts` | Token DI `AUTH_CLIENT`. |

### Cấu hình
- `.env` (root): `RABBITMQ_URL`, tên các queue, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- `apps/auth-service/.env`: `DATABASE_URL` (giữ nguyên).
- `apps/auth-service/prisma/seed.ts`: tạo user demo để test.

---

## 3. Chạy thử end-to-end

### B1. Bật hạ tầng (RabbitMQ + Postgres)
```bash
# Mở Docker Desktop trước, rồi:
docker compose up -d postgres-auth rabbitmq
```
- RabbitMQ UI: http://localhost:15672  (user/pass: `guest`/`guest`)

### B2. Tạo bảng + user demo
```bash
pnpm db:migrate:auth   # tạo bảng "User" trong postgres-auth
pnpm db:seed           # thêm demo@omial.dev / password123
```

### B3. Chạy 2 service (2 terminal riêng)
```bash
# Terminal 1
pnpm start:auth        # auth-service nghe queue "auth_queue"

# Terminal 2
pnpm start:gateway     # api-gateway: http://localhost:3000
```

### B4. Gọi thử login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@omial.dev","password":"password123"}'
```
Kết quả mong đợi (đã bọc envelope bởi `ResponseInterceptor`):
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": { "id": "…", "email": "demo@omial.dev" }
  },
  "timestamp": "..."
}
```
Sai mật khẩu → HTTP 401 `{ "success": false, "message": "Email hoặc mật khẩu không đúng" }`.

> Có thể xem queue `auth_queue` xuất hiện trong RabbitMQ UI tab **Queues**.

---

## 4. Vì sao tổ chức như vậy? (điểm học)

1. **Contract tách riêng (`event-contracts`)**: gateway & service ở 2 process
   khác nhau, không import lẫn code nội bộ của nhau. Chỉ chia sẻ pattern + DTO.
2. **Factory options dùng chung (`libs/shared`)**: mọi service cấu hình
   RabbitMQ y hệt nhau → sửa 1 chỗ.
3. **Filter hiểu 2 context**: cùng 1 bộ xử lý lỗi cho cả HTTP (gateway) lẫn RPC
   (service). Lỗi ở service được truyền nguyên trạng mã lỗi về gateway.
4. **Auth ký ở service, verify ở gateway**: login (ký JWT) nằm ở auth-service;
   các request sau sẽ được gateway verify token (bước kế tiếp, chưa làm ở đây).
5. **`registerAsync` + `useFactory`**: đọc env lúc chạy, không phải lúc import —
   tránh lỗi env `undefined`.

---

## 5. Bước tiếp theo (khi muốn mở rộng)
- Thêm `register` (đăng ký) — cùng pattern, thêm `@MessagePattern('auth.register')`.
- `JwtAuthGuard` ở gateway để verify token + `RolesGuard`.
- Lặp lại mô hình cho `product` / `order` / `inventory`.
- Luồng **event** (`emit`) ví dụ order → inventory (fire-and-forget).
