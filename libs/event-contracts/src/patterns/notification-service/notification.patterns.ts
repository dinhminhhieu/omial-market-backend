/**
 * EVENT patterns (khác hẳn message patterns của các service khác).
 *
 * Quy ước đặt tên: `<chủ_thể>.<đã_xảy_ra>` — thì QUÁ KHỨ, vì event mô tả một
 * việc ĐÃ xảy ra rồi ("OTP đã được yêu cầu"), không phải mệnh lệnh ("hãy gửi OTP").
 * Đây là khác biệt tư duy cốt lõi: người phát KHÔNG ra lệnh cho ai, chỉ thông
 * báo sự thật; ai quan tâm thì tự xử.
 *
 * Dùng với `client.emit(pattern, payload)` (bên phát) và `@EventPattern(pattern)`
 * (bên nghe) — KHÔNG phải `send`/`@MessagePattern` (đó là RPC có chờ hồi đáp).
 */
export const NOTIFICATION_PATTERNS = {
  // Auth phát khi cần gửi OTP (đăng ký / gửi lại / quên mật khẩu).
  // notification-service nghe rồi gửi email — auth KHÔNG chờ.
  OTP_REQUESTED: 'otp.requested',
} as const;
