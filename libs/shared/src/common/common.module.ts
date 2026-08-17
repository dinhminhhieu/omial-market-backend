import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { InternalAuthGuard } from './guards/internal-auth.guard';

/**
 * Đăng ký các cross-cutting concern ở phạm vi TOÀN service qua DI tokens.
 * Chỉ cần `imports: [CommonModule]` trong module gốc của mỗi service là có:
 * - AllExceptionsFilter       (format lỗi chuẩn)
 * - ClassSerializerInterceptor (chống leak field nhạy cảm / chèn @Exclude/@Expose)
 * - ResponseInterceptor       (bọc response envelope, hỗ trợ @SkipResponseWrap)
 * - InternalAuthGuard        (chặn message RMQ không mang internal token)
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: InternalAuthGuard },
  ],
})
export class CommonModule {}
