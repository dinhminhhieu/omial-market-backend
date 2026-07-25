/**
 * Danh sách "message pattern" của auth-service.
 *
 * Gateway dùng key này khi `client.send(AUTH_PATTERNS.LOGIN, dto)`;
 * auth-service dùng đúng key đó ở `@MessagePattern(AUTH_PATTERNS.LOGIN)`.
 * Đặt tập trung 1 chỗ để 2 bên KHÔNG bao giờ gõ lệch chuỗi.
 *
 * Quy ước tên: `<service>.<động_từ>` cho RPC (send/chờ trả về).
 */
export const AUTH_PATTERNS = {
  /** Đăng nhập → trả cặp token + user. Chặn nếu chưa xác thực email. */
  LOGIN: 'auth.login',
  /** Đăng ký → tạo user (chưa verify) + gửi OTP qua email. */
  REGISTER: 'auth.register',
  /** Xác thực OTP đăng ký → bật isEmailVerified + auto login (trả token). */
  VERIFY_OTP: 'auth.verify_otp',
  /** Gửi lại OTP (cho cả luồng verify đăng ký lẫn reset mật khẩu). */
  RESEND_OTP: 'auth.resend_otp',
  /** Quên mật khẩu → gửi OTP reset về email. */
  FORGOT_PASSWORD: 'auth.forgot_password',
  /** Đặt lại mật khẩu bằng OTP → đổi pass + thu hồi mọi refresh token cũ. */
  RESET_PASSWORD: 'auth.reset_password',
  /** Refresh: đổi refresh token cũ lấy cặp token mới (rotation). */
  REFRESH_TOKEN: 'auth.refresh_token',
  /** Đăng xuất: thu hồi refresh token khỏi Redis. */
  LOGOUT: 'auth.logout',
} as const;
