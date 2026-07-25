import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';

/**
 * Đăng ký các cross-cutting concern ở phạm vi TOÀN service qua DI tokens.
 * Chỉ cần `imports: [CommonModule]` trong module gốc của mỗi service là có:
 * - AllExceptionsFilter  (format lỗi chuẩn)
 * - ResponseInterceptor  (bọc response envelope, hỗ trợ @SkipResponseWrap)
 *
 * Các thành phần opt-in (bật thủ công khi cần, tránh trùng lặp):
 * - LoggingInterceptor: log request + thời gian. Đã có LoggerMiddleware làm
 *   access-log nên không bật global mặc định. Muốn dùng thay middleware:
 *   `{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }`.
 * - TimeoutInterceptor: `{ provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor }`.
 * - RolesGuard: cần AuthGuard điền `request.user` trước. Muốn bật:
 *   `{ provide: APP_GUARD, useClass: RolesGuard }`.
 *
 * ValidationPipe được set ở `main.ts` qua `setupApp()`.
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class CommonModule {}
