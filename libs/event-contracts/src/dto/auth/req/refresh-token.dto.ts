import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty } from 'class-validator';

/** Xin cặp token mới bằng refresh token còn hạn (dùng cho refresh & logout). */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token đã cấp trước đó',
    example: 'eyJhbGciOi...',
  })
  @IsNotEmpty()
  @IsJWT({ message: 'refreshToken không hợp lệ' })
  refreshToken: string;
}
