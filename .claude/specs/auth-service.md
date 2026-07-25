# Spec: auth-service

**Vai trò:** pure RabbitMQ microservice (KHÔNG có HTTP). Xử lý xác thực.
**Queue lắng nghe:** `auth_queue` (env `RMQ_AUTH_QUEUE`).
**DB:** `postgres-auth` (port host 5433) qua Prisma 7 + `@prisma/adapter-pg`.
**Hạ tầng phụ:** Redis (lưu OTP + refresh token) · SMTP (gửi OTP qua nodemailer).

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
| [mail/mail.service.ts](../../apps/auth-service/src/mail/mail.service.ts) | nodemailer. Thiếu SMTP_USER/PASS → **fallback log OTP ra console**. |
| [mail/mail.module.ts](../../apps/auth-service/src/mail/mail.module.ts) | `@Global` — provide `MailService`. |
| [prisma/prisma.service.ts](../../apps/auth-service/src/prisma/prisma.service.ts) | PrismaClient + `PrismaPg` adapter (đọc `DATABASE_URL`). |
| [prisma/schema.prisma](../../apps/auth-service/prisma/schema.prisma) | Model `User` (đã có sẵn `isEmailVerified, isVerified, isActive, isBanned, role, fullName, lastLoginAt`…). **OTP/refresh token KHÔNG ở DB — nằm trong Redis.** |

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

## Quy ước / lưu ý
- `JwtModule.registerAsync` = cấu hình **access token**. Refresh token dùng secret/hạn riêng, `TokenService` truyền trực tiếp khi ký/verify.
- Không tự bọc response; envelope do gateway lo. Filter RPC (CommonModule) map exception → `RpcErrorPayload`.
- Không lộ password. OTP lưu hash, so sánh hằng-thời-gian.
- SMTP để trống → OTP log ra console (dev vẫn chạy được toàn luồng).
- `revokeAll` dùng `KEYS refresh:<userId>:*` — ổn ở quy mô học tập; production nên `SCAN`.

## Trạng thái & TODO
- ✅ Login (chặn chưa verify) · Register + OTP · Verify OTP · Resend OTP · Forgot/Reset password · Refresh (rotation) · Logout.
- ⬜ Đổi mật khẩu khi đã đăng nhập (change-password), quản lý phiên (list/revoke theo thiết bị).
- ⬜ (Tương lai) tách `users/` module nếu quản lý user phình to.
