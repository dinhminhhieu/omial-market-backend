# Spec: auth-service

**Vai trò:** pure RabbitMQ microservice (KHÔNG có HTTP). Xử lý xác thực.
**Queue lắng nghe:** `auth_queue` (env `RMQ_AUTH_QUEUE`).
**DB:** `postgres-auth` (port host 5433) qua Prisma 7 + `@prisma/adapter-pg`.
**Hạ tầng phụ:** Redis (lưu OTP + refresh token) · RabbitMQ client → notification-service.
**KHÔNG còn gửi mail** — đã tách sang notification-service (7.2), auth chỉ PHÁT event.

## Bản đồ file
| File | Vai trò |
| --- | --- |
| [main.ts](../../apps/auth-service/src/main.ts) | Bootstrap `createMicroservice`. Nạp dotenv (root `.env` + `apps/auth-service/.env`) TRƯỚC khi khởi động. |
| [auth-service.module.ts](../../apps/auth-service/src/auth-service.module.ts) | Root: `CommonModule` + `RedisModule.forRoot({ keyPrefix: 'auth:' })` (từ `@app/shared`) + `MailModule` (@Global) + `AuthModule`. |
| [auth/auth.module.ts](../../apps/auth-service/src/auth/auth.module.ts) | Feature module: `PrismaModule` + `JwtModule.registerAsync` (access token) + controller + service + `OtpService` + `TokenService`. |
| [auth/auth.controller.ts](../../apps/auth-service/src/auth/auth.controller.ts) | 8 `@MessagePattern` handlers (bảng dưới). |
| [auth/auth.service.ts](../../apps/auth-service/src/auth/auth.service.ts) | Điều phối luồng: login, register, verifyOtp, resendOtp, forgotPassword, resetPassword, refresh, logout. |
| [auth/otp.service.ts](../../apps/auth-service/src/auth/otp.service.ts) | OTP: sinh mã 6 số, lưu **hash SHA-256** vào Redis (TTL) + cooldown + đếm số lần nhập sai. |
| [auth/token.service.ts](../../apps/auth-service/src/auth/token.service.ts) | Access token (`JWT_SECRET`) + refresh token (`JWT_REFRESH_SECRET`) lưu Redis `refresh:<userId>:<jti>`. Rotation / revoke / revokeAll. |
| `RedisService` (từ `@app/shared`) | Wrapper ioredis DÙNG CHUNG ở [libs/shared/src/common/redis](../../libs/shared/src/common/redis/redis.service.ts). Auth chỉ inject, không tự viết. Xem [shared-libs.md](shared-libs.md). |
| [outbox/outbox.service.ts](../../apps/auth-service/src/outbox/outbox.service.ts) | **Phần GHI của Outbox (7.3)** — `enqueue(tx, pattern, payload)`. Nhận `tx` từ bên gọi, KHÔNG tự mở transaction (tự mở = dual write, đúng bệnh cần chữa). |
| [outbox/outbox.worker.ts](../../apps/auth-service/src/outbox/outbox.worker.ts) | **Phần PHÁT** — `@Interval(1000)` đọc PENDING (`FOR UPDATE SKIP LOCKED`) → `emit` → SENT. Fail thì `attempts++` + backoff `nextRetryAt`, quá 5 lần → FAILED. |
| [outbox/outbox.module.ts](../../apps/auth-service/src/outbox/outbox.module.ts) | `@Global`. **ClientProxy RMQ nằm ở đây, KHÔNG ở AuthModule** — sau outbox thì chỉ worker được publish. |
| [prisma/prisma.service.ts](../../apps/auth-service/src/prisma/prisma.service.ts) | PrismaClient + `PrismaPg` adapter (đọc `DATABASE_URL`). |
| [prisma/schema.prisma](../../apps/auth-service/prisma/schema.prisma) | Model `User` + **`OutboxEvent`** (pattern, payload Json, status, attempts, nextRetryAt). **OTP/refresh token KHÔNG ở DB — nằm trong Redis.** |

## Message patterns xử lý (từ `AUTH_PATTERNS`)
| Pattern | Payload | Trả về | Ghi chú |
| --- | --- | --- | --- |
| `auth.login` | `LoginDto` | `LoginResponseDto` | bcrypt.compare → chặn nếu `!isEmailVerified` (403) / bị khoá → cấp cặp token + update `lastLoginAt`. |
| `auth.register` | `RegisterDto` | `MessageResponseDto` | Tạo user `isEmailVerified=false` (upsert nếu chưa verify) → gửi OTP. Email đã verify → 409. |
| `auth.verify_otp` | `VerifyOtpDto` | `LoginResponseDto` | Verify OTP (purpose VERIFY) → set `isEmailVerified/isVerified=true` → **auto login** (trả token). |
| `auth.resend_otp` | `ResendOtpDto` | `MessageResponseDto` | Gửi lại OTP theo `purpose` (VERIFY/RESET). Cooldown do OtpService chặn (429). |
| `auth.forgot_password` | `ForgotPasswordDto` | `MessageResponseDto` | Gửi OTP reset. **Luôn trả thông báo chung** (chống dò email). |
| `auth.reset_password` | `ResetPasswordDto` | `MessageResponseDto` | Verify OTP (RESET) → đổi pass → `revokeAll` refresh token cũ. |
| `auth.refresh_token` | `RefreshTokenDto` | `AuthTokensDto` | Verify refresh + check Redis + user active → **rotation** (xoá jti cũ, cấp cặp mới). |
| `auth.logout` | `LogoutDto` | `MessageResponseDto` | Revoke refresh token khỏi Redis. Idempotent. |

## Redis key (đều được tự cộng prefix `auth:` bởi RedisService — code dùng key "logic" dưới đây)
- `otp:<purpose>:<email>` = hash OTP (TTL `OTP_TTL`). `otp:attempts:<purpose>:<email>` = đếm sai. `otp:cooldown:<purpose>:<email>` (TTL `OTP_RESEND_COOLDOWN`).
- `refresh:<userId>:<jti>` = `1` (TTL `JWT_REFRESH_EXPIRES_IN`). Còn key ⇒ token còn hiệu lực.

## Env cần
- `DATABASE_URL` (ở `apps/auth-service/.env`).
- Root `.env`: `RABBITMQ_URL`, `RMQ_AUTH_QUEUE`, `JWT_SECRET`, `JWT_EXPIRES_IN` (900s), `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` (604800s), `REDIS_URL`, `OTP_TTL`, `OTP_RESEND_COOLDOWN`, `OTP_MAX_ATTEMPTS`, `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM`.

## 📤 Outbox pattern (7.3) — đọc trước khi thêm event mới

**Luật:** nghiệp vụ **KHÔNG** được `client.emit()` trực tiếp. Chỉ được `outbox.enqueue(tx, ...)`.

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.user.upsert({ ... });                     // việc nghiệp vụ
  await this.sendOtp(tx, email, purpose);            // → outbox.enqueue(tx, ...)
});                                                   // MỘT commit cho cả hai
```

- Chỉ ghi **1 dòng** (không kèm ghi nghiệp vụ nào) thì **không cần** `$transaction` —
  một INSERT tự nó atomic. Truyền thẳng `this.prisma` (xem `resendOtp`/`forgotPassword`).
- **Thứ tự với Redis**: tạo OTP (Redis) TRƯỚC, rồi mới vào transaction. Ngược lại →
  crash giữa chừng sẽ gửi mã OTP không có trong Redis, khách nhập đúng vẫn báo sai.
  Nguyên tắc: việc "thừa thì vô hại" làm trước, việc "thiếu thì chết" vào transaction.
- Outbox đổi **"có thể MẤT event"** lấy **"có thể TRÙNG event"** (worker crash sau khi
  publish, trước khi đánh dấu SENT) → **7.4 idempotency là bắt buộc**, không phải tuỳ chọn.
- Backoff `nextRetryAt` (2^n giây) là **BẮT BUỘC**: không có nó, `@Interval(1000)` đốt
  sạch 5 lần thử trong 5 giây → broker restart 10s là mọi event bị FAILED vĩnh viễn.
- Đã smoke: tắt RabbitMQ → register vẫn 201, event nằm PENDING; bật lại → SENT.

**Cải tiến để dành:** transaction hiện ôm cả network I/O (publish 20 event trong 1 tx,
Prisma timeout mặc định 5s). Bài bản hơn là *claim pattern*: tx ngắn chỉ đánh dấu
`PROCESSING` → publish ngoài tx → update SENT. Chưa cần ở quy mô này.

## Quy ước / lưu ý
- `JwtModule.registerAsync` = cấu hình **access token**. Refresh token dùng secret/hạn riêng, `TokenService` truyền trực tiếp khi ký/verify.
- Không tự bọc response; envelope do gateway lo. Filter RPC (CommonModule) map exception → `RpcErrorPayload`.
- Không lộ password. OTP lưu hash, so sánh hằng-thời-gian.
- SMTP để trống → OTP log ra console (dev vẫn chạy được toàn luồng).
- `revokeAll` dùng `KEYS refresh:<userId>:*` — ổn ở quy mô học tập; production nên `SCAN`.

## Trạng thái & TODO
- ✅ Login (chặn chưa verify) · Register + OTP · Verify OTP · Resend OTP · Forgot/Reset password · Refresh (rotation) · Logout.
- ✅ **7.2**: gửi mail tách sang notification-service (auth `emit('otp.requested')`).
- ✅ **7.3 Outbox**: `OutboxEvent` + worker + backoff — event không mất khi crash/broker sập.
- ⬜ Đổi mật khẩu khi đã đăng nhập (change-password), quản lý phiên (list/revoke theo thiết bị).
- ⬜ (Tương lai) tách `users/` module nếu quản lý user phình to.
