# Spec: api-gateway

**Vai trò:** app HTTP duy nhất (REST + Swagger `/docs`). Facade — nhận REST,
forward qua RabbitMQ tới service, trả kết quả. KHÔNG chứa business logic.
**Cổng:** `http://localhost:3000` (prefix `/api`).

## Bản đồ file
| File | Vai trò |
| --- | --- |
| [main.ts](../../apps/api-gateway/src/main.ts) | `NestFactory.create` + `setupApp` (HTTP, CORS, Swagger). Nạp dotenv root `.env`. |
| [api-gateway.module.ts](../../apps/api-gateway/src/api-gateway.module.ts) | `ClientsModule.registerAsync` các ClientProxy RMQ + đăng ký controllers. |
| [clients.ts](../../apps/api-gateway/src/clients.ts) | Token DI cho ClientProxy (vd `AUTH_CLIENT`). |
| [auth/auth.controller.ts](../../apps/api-gateway/src/auth/auth.controller.ts) | 8 route REST `/auth/*` → forward RPC qua helper `forward<T>(pattern, payload)` (gom timeout + map lỗi). |

## Clients RMQ đã đăng ký
| Token | Queue (env) | Tới service |
| --- | --- | --- |
| `AUTH_CLIENT` | `RMQ_AUTH_QUEUE` (`auth_queue`) | auth-service |

## Endpoints (tất cả `@Public`, prefix `/api`)
| Method + Path | Forward tới pattern | DTO |
| --- | --- | --- |
| `POST /auth/login` | `auth.login` | `LoginDto` → `LoginResponseDto` |
| `POST /auth/register` | `auth.register` | `RegisterDto` → `MessageResponseDto` |
| `POST /auth/verify-otp` | `auth.verify_otp` | `VerifyOtpDto` → `LoginResponseDto` |
| `POST /auth/resend-otp` | `auth.resend_otp` | `ResendOtpDto` → `MessageResponseDto` |
| `POST /auth/forgot-password` | `auth.forgot_password` | `ForgotPasswordDto` → `MessageResponseDto` |
| `POST /auth/reset-password` | `auth.reset_password` | `ResetPasswordDto` → `MessageResponseDto` |
| `POST /auth/refresh` | `auth.refresh_token` | `RefreshTokenDto` → `AuthTokensDto` |
| `POST /auth/logout` | `auth.logout` | `LogoutDto` → `MessageResponseDto` |

## Quy ước / lưu ý
- Gọi RPC: `firstValueFrom(client.send(pattern, dto).pipe(timeout(5000), catchError(...)))`.
- **Map lỗi RPC → HttpException**: đọc `{statusCode,message}` (kiểu `RpcErrorPayload`) từ service, `TimeoutError` → 504. Nhờ vậy `AllExceptionsFilter` (HTTP) format chuẩn.
- Response tự bọc envelope bởi `ResponseInterceptor` (qua `CommonModule`).
- `@Public()` đánh dấu route công khai (cho khi bật AuthGuard sau).

## Trạng thái & TODO
- ✅ Đầy đủ 8 route auth: login, register, verify-otp, resend-otp, forgot/reset-password, refresh, logout.
- ⬜ `JwtAuthGuard` verify access token + gắn `userId` vào payload forward.
- ⬜ Thêm client + controller cho product / order / inventory.
