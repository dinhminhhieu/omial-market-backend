import { ApiProperty } from '@nestjs/swagger';

/**
 * Response chỉ mang 1 thông báo (không có data), dùng cho các luồng mà client
 * chỉ cần biết "đã xử lý xong": register (đã gửi OTP), resend, forgot-password,
 * reset-password, logout.
 */
export class MessageResponseDto {
  @ApiProperty({ example: 'Đã gửi mã OTP tới email của bạn.' })
  message: string;
}
