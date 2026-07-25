/**
 * Mục đích của một mã OTP. Dùng làm 1 phần của key trong Redis
 * (`otp:<purpose>:<email>`) để OTP đăng ký và OTP reset mật khẩu KHÔNG đè lên
 * nhau, và để MailService chọn đúng nội dung email.
 */
export enum OtpPurpose {
  /** OTP xác thực email khi đăng ký. */
  VERIFY = 'verify',
  /** OTP đặt lại mật khẩu (quên mật khẩu). */
  RESET_PASSWORD = 'reset_password',
}
