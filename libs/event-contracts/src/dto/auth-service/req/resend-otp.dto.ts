import { OtpPurpose } from '@app/event-contracts/enums/otp-purpose.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Gửi lại OTP. `purpose` cho biết gửi lại OTP nào:
 * - VERIFY (mặc định): OTP xác thực email khi đăng ký.
 * - RESET_PASSWORD: OTP đặt lại mật khẩu.
 * Có cooldown (mặc định 60s) để chống spam gửi mail.
 */
export class ResendOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({
    enum: OtpPurpose,
    default: OtpPurpose.VERIFY,
    required: false,
    description: 'Loại OTP cần gửi lại',
  })
  @IsOptional()
  @IsEnum(OtpPurpose, { message: 'purpose không hợp lệ' })
  purpose?: OtpPurpose = OtpPurpose.VERIFY;
}
