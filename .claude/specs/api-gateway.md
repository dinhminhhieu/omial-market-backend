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
| [auth/auth.controller.ts](../../apps/api-gateway/src/auth/auth.controller.ts) | 8 route REST `/auth/*` → forward RPC qua `RmqForwarder` (`@app/shared`). |
| [brand/brand.controller.ts](../../apps/api-gateway/src/brand/brand.controller.ts) | 5 route REST `/brands/*` → forward RPC tới product-service qua `RmqForwarder`. |

## Clients RMQ đã đăng ký
| Token | Queue (env) | Tới service |
| --- | --- | --- |
| `AUTH_CLIENT` | `RMQ_AUTH_QUEUE` (`auth_queue`) | auth-service |
| `PRODUCT_CLIENT` | `RMQ_PRODUCT_QUEUE` (`product_queue`) | product-service |

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

### Brands (`/brands`, forward tới product-service, `BRAND_PATTERNS`)
CRUD chuẩn: `POST /` (create) · `GET /` (findAll, phân trang) · `GET /:id` · `PUT /:id` (payload `{...dto, id}`) · `DELETE /:id` (soft delete).

## Quy ước / lưu ý
- Gọi RPC qua **`RmqForwarder`** (`@app/shared`, xem [shared-libs.md](shared-libs.md)): controller tạo instance trong constructor `new RmqForwarder(client, 'tên-service')`, route handler gọi `this.x.send(PATTERN, payload)`. Timeout 5s + map lỗi RPC (`RpcErrorPayload`) → `HttpException`, `TimeoutError` → 504 — KHÔNG tự viết lại `firstValueFrom/timeout/catchError` trong controller mới.
- Response tự bọc envelope bởi `ResponseInterceptor` (qua `CommonModule`).
- `@Public()` đánh dấu route công khai (cho khi bật AuthGuard sau).

## Trạng thái & TODO
- ✅ Đầy đủ 8 route auth: login, register, verify-otp, resend-otp, forgot/reset-password, refresh, logout.
- ✅ `PRODUCT_CLIENT` + 5 route `/brands` CRUD (forward tới product-service).
- ✅ Helper RPC dùng chung `RmqForwarder` (thay `forward/toHttpException` copy-paste từng controller).
- 🟡 Route `/labels` đang code dở (label.controller.ts).
- ⬜ `JwtAuthGuard` verify access token + gắn `userId` vào payload forward.
- ⬜ Controller cho category/product/variant + client order / inventory.
