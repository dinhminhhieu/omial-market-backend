# Spec: libs/shared + libs/event-contracts

Hai lib dùng chung cho mọi app. Import qua alias `@app/shared`, `@app/event-contracts`.

## libs/shared — hạ tầng dùng chung
Barrel: [common/index.ts](../../libs/shared/src/common/index.ts). Các nhóm chính:

| Nhóm | File | Vai trò |
| --- | --- | --- |
| Config RMQ | [config/rmq.options.ts](../../libs/shared/src/common/config/rmq.options.ts) | `rmqClientOptions(queue)` (gateway) · `rmqServerOptions(queue)` (service, **`noAck: true`** — auto-ack; KHÔNG dùng `noAck:false` vì handler RPC không tự ack → sẽ treo sau message đầu). Đọc `RABBITMQ_URL` **trong hàm** (sau khi dotenv nạp). |
| Redis | [redis/redis.service.ts](../../libs/shared/src/common/redis/redis.service.ts) · [redis/redis.module.ts](../../libs/shared/src/common/redis/redis.module.ts) | Wrapper ioredis dùng chung: `set(ttl)/get/del/exists/ttl/incr/expire/keys`. **Opt-in**: `RedisModule.forRoot({ keyPrefix })` (global, KHÔNG gộp CommonModule). `keyPrefix` cộng ở tầng wrapper → mỗi service tự namespace, không đụng key. Logic OTP/token vẫn ở service. |
| Bootstrap | [bootstrap/setup-app.ts](../../libs/shared/src/common/bootstrap/setup-app.ts) | `setupApp(app)` — HTTP: prefix, CORS, ValidationPipe, Swagger, shutdown. |
| Bootstrap | [bootstrap/setup-microservice.ts](../../libs/shared/src/common/bootstrap/setup-microservice.ts) | `setupMicroservice(app)` — chỉ ValidationPipe + shutdown (microservice). |
| Filter | [filters/all-exceptions.filter.ts](../../libs/shared/src/common/filters/all-exceptions.filter.ts) | Bắt mọi lỗi. **Host-type aware**: HTTP → JSON envelope lỗi; RPC → trả `throwError(RpcErrorPayload)` gửi ngược broker. Export type `RpcErrorPayload {statusCode,message,errors}`. |
| Interceptor | [interceptors/response.interceptor.ts](../../libs/shared/src/common/interceptors/response.interceptor.ts) | Bọc envelope response thành công (chỉ HTTP; RPC passthrough). `@SkipResponseWrap()` để bỏ qua. |
| Interceptor | [interceptors/timeout.interceptor.ts](../../libs/shared/src/common/interceptors/timeout.interceptor.ts) · [logging.interceptor.ts](../../libs/shared/src/common/interceptors/logging.interceptor.ts) | Opt-in. |
| Module | [common.module.ts](../../libs/shared/src/common/common.module.ts) | Đăng ký global `AllExceptionsFilter` (APP_FILTER) + `ResponseInterceptor` (APP_INTERCEPTOR). **Import `CommonModule` ở root module mỗi app**. |
| Decorators | `decorators/*` | `@Public`, `@Roles`, `@CurrentUser`, `@ApiSuccessResponse`, `@SkipResponseWrap`. |
| DTO/Pipe/Guard | `dto/*`, `pipes/*`, `guards/roles.guard.ts` | Envelope DTO, `createValidationPipe`, RolesGuard (cần AuthGuard điền `request.user`). |

## libs/event-contracts — hợp đồng message
Barrel: [src/index.ts](../../libs/event-contracts/src/index.ts).

| File | Nội dung |
| --- | --- |
| [patterns/auth.patterns.ts](../../libs/event-contracts/src/patterns/auth.patterns.ts) | `AUTH_PATTERNS`: LOGIN, REGISTER, VERIFY_OTP, RESEND_OTP, FORGOT_PASSWORD, RESET_PASSWORD, REFRESH_TOKEN, LOGOUT. |
| [enums/otp-purpose.enum.ts](../../libs/event-contracts/src/enums/otp-purpose.enum.ts) | `OtpPurpose { VERIFY, RESET_PASSWORD }` — 1 phần của Redis key + chọn nội dung mail. |
| [dto/auth/](../../libs/event-contracts/src/dto/auth/) | Request: `LoginDto`, `RegisterDto`, `VerifyOtpDto`, `ResendOtpDto`, `ForgotPasswordDto`, `ResetPasswordDto`, `RefreshTokenDto`, `LogoutDto`. |
| ↳ response | `AuthTokensDto {accessToken,refreshToken}`, `LoginResponseDto extends AuthTokensDto {+user}`, `AuthUserDto`, `MessageResponseDto {message}`. |

## Quy ước khi thêm tính năng mới
1. Thêm pattern vào `patterns/<service>.patterns.ts` (RPC = danh từ.động_từ; event = `<service>.<đã_xảy_ra>`).
2. Thêm DTO payload + response vào `dto/<service>/`.
3. Export ở `index.ts`.
4. Gateway `send()`/`emit()` và service `@MessagePattern`/`@EventPattern` dùng CHUNG hằng + DTO này.

## Trạng thái & TODO
- ✅ Auth contracts đầy đủ: login, register, verify/resend OTP, forgot/reset password, refresh, logout.
- ⬜ Patterns/DTO cho product, order (event), inventory.
