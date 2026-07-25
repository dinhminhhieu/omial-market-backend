/**
 * Cấu trúc response chuẩn cho toàn hệ thống (khớp với DTO Swagger
 * `ApiSuccessResponseDto` / `ApiErrorResponseDto`).
 * - TransformInterceptor bọc response thành công theo `ApiResponse`.
 * - AllExceptionsFilter format lỗi theo `ApiErrorResponse`.
 */
export interface ApiResponse<T = unknown> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors: string[] | null;
  path: string;
  timestamp: string;
}

/**
 * Payload user gắn vào request sau khi qua Auth (JWT) — dùng cho RolesGuard,
 * CurrentUser decorator. Mở rộng thêm field khi tích hợp auth thực tế.
 */
export interface AuthenticatedUser {
  sub: string | number;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}
