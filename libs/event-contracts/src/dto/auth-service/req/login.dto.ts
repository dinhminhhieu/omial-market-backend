import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Payload gửi kèm message `AUTH_PATTERNS.LOGIN`.
 *
 * - Ở gateway: validate `@Body()` khi client POST /auth/login.
 * - Ở auth-service: validate lại `@Payload()` khi nhận từ RabbitMQ.
 *   (ValidationPipe chạy ở CẢ hai phía nhờ dùng chung DTO này.)
 */
export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  // ⚠️ ĐĂNG NHẬP KHÔNG validate ĐỘ MẠNH mật khẩu — quy tắc mạnh/yếu chỉ áp lúc
  // ĐẶT mật khẩu (register / reset). Bắt ở login vừa vô nghĩa (mật khẩu đã tồn
  // tại rồi), vừa khoá cửa người dùng cũ khi chính sách siết lại, lại còn tiết
  // lộ luật đặt mật khẩu cho kẻ dò. Chỉ cần "có gửi lên và không rỗng".
  @ApiProperty({ example: 'Password123' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' }) // giới hạn thật của bcrypt
  password: string;
}
