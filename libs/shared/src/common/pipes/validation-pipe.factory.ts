import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * Tạo global `ValidationPipe` với cấu hình chuẩn cho toàn hệ thống:
 * - `whitelist`: loại bỏ field không khai báo trong DTO.
 * - `forbidNonWhitelisted`: báo lỗi nếu client gửi field lạ.
 * - `transform`: tự convert payload thành instance của DTO (kèm ép kiểu primitive).
 *
 * Yêu cầu `class-validator` & `class-transformer` (đã cài trong dependencies).
 */
export function createValidationPipe(
  options: ValidationPipeOptions = {},
): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    ...options,
  });
}
