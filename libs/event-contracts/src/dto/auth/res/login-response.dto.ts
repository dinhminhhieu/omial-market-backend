import { ApiProperty } from '@nestjs/swagger';
import { AuthTokensDto } from '../req/auth-tokens.dto';

/** Thông tin user trả về cho client (KHÔNG bao giờ kèm password). */
export class AuthUserDto {
  @ApiProperty({ example: '6f1e2c3a-...' })
  id: string;

  @ApiProperty({ example: 'demo@omial.dev' })
  email: string;

  @ApiProperty({ example: 'USER', required: false })
  role?: string;

  @ApiProperty({ example: 'Nguyễn Văn A', required: false, nullable: true })
  fullName?: string | null;
}

/**
 * Kết quả login (và verify-otp): cặp token + thông tin user.
 * Kế thừa `AuthTokensDto` nên đã có sẵn `accessToken` + `refreshToken`.
 */
export class LoginResponseDto extends AuthTokensDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
