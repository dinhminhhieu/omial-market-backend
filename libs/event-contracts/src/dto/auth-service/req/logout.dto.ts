import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty } from 'class-validator';

/** Đăng xuất: gửi refresh token cần thu hồi khỏi Redis. */
export class LogoutDto {
  @ApiProperty({
    description: 'Refresh token cần thu hồi',
    example: 'eyJhbGciOi...',
  })
  @IsNotEmpty()
  @IsJWT({ message: 'refreshToken không hợp lệ' })
  refreshToken: string;
}
