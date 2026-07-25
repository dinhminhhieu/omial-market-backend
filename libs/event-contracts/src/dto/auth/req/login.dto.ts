import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(/(?=.*[A-Z])/, { message: 'Mật khẩu phải có ít nhất 1 chữ hoa' })
  @Matches(/(?=.*[0-9])/, { message: 'Mật khẩu phải có ít nhất 1 chữ số' })
  password: string;
}
