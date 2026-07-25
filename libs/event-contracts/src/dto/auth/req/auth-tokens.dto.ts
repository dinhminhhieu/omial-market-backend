import { ApiProperty } from '@nestjs/swagger';

/**
 * Cặp token trả về sau login / verify-otp / refresh.
 * - accessToken: sống ngắn (mặc định 15 phút) — gắn vào header mỗi request.
 * - refreshToken: sống dài (mặc định 7 ngày), lưu trong Redis — dùng để xin
 *   accessToken mới khi hết hạn mà không phải đăng nhập lại.
 */
export class AuthTokensDto {
  @ApiProperty({
    description: 'JWT access token (ngắn hạn)',
    example: 'eyJhbGciOi...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token (dài hạn)',
    example: 'eyJhbGciOi...',
  })
  refreshToken: string;
}
