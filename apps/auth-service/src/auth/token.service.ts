import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AuthTokensDto } from '@app/event-contracts';
import { RedisService } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Thông tin tối thiểu cần để ký token (lấy từ bản ghi User). */
interface TokenUser {
  id: string;
  email: string | null;
  role: string | null;
}

/** Payload bên trong refresh token. `jti` = id riêng của từng refresh token. */
interface RefreshPayload {
  sub: string;
  jti: string;
}

/**
 * Quản lý vòng đời token.
 *
 * - accessToken: JWT ngắn hạn, ký bằng `JWT_SECRET` (chung với gateway để
 *   gateway verify được). KHÔNG lưu server — stateless.
 * - refreshToken: JWT dài hạn, ký bằng `JWT_REFRESH_SECRET` riêng, VÀ lưu 1 key
 *   `refresh:<userId>:<jti>` trong Redis. Token chỉ hợp lệ khi key còn tồn tại
 *   → nhờ vậy revoke/logout được (điều mà JWT thuần không làm được).
 *
 * Rotation: mỗi lần refresh, xoá jti cũ rồi cấp jti mới. Nếu kẻ gian dùng lại
 * refresh token cũ (đã xoay) → key không còn → bị từ chối.
 */
@Injectable()
export class TokenService {
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET ?? 'super-secret-refresh-key';
  private readonly refreshTtl = Number(
    process.env.JWT_REFRESH_EXPIRES_IN ?? 604800, // 7 ngày
  );

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /** Cấp cặp token mới và lưu refresh token vào Redis. */
  async issueTokens(user: TokenUser): Promise<AuthTokensDto> {
    // Access token: dùng secret + expiresIn mặc định của JwtModule.
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Refresh token: jti duy nhất + secret & hạn riêng.
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti },
      { secret: this.refreshSecret, expiresIn: this.refreshTtl },
    );

    await this.redis.set(this.key(user.id, jti), '1', this.refreshTtl);
    return { accessToken, refreshToken };
  }

  /**
   * Đổi refresh token cũ lấy cặp mới (rotation). Kiểm tra: chữ ký hợp lệ + key
   * còn trong Redis + user còn tồn tại/active. Đạt hết → xoá jti cũ, cấp mới.
   */
  async rotate(refreshToken: string): Promise<AuthTokensDto> {
    const { sub, jti } = await this.verify(refreshToken);

    // Key mất nghĩa là token đã bị thu hồi/đã xoay/đăng xuất → từ chối.
    if (!(await this.redis.exists(this.key(sub, jti)))) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }
    await this.redis.del(this.key(sub, jti)); // rotation: vô hiệu cái cũ

    const user = await this.prisma.user.findUnique({ where: { id: sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Người dùng không tồn tại hoặc bị khoá');
    }

    return this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  /** Thu hồi 1 refresh token (đăng xuất). Idempotent: token rác thì bỏ qua. */
  async revoke(refreshToken: string): Promise<void> {
    try {
      const { sub, jti } = await this.verify(refreshToken);
      await this.redis.del(this.key(sub, jti));
    } catch {
      // token hỏng/hết hạn → coi như đã đăng xuất, không cần báo lỗi.
    }
  }

  /** Thu hồi TẤT CẢ refresh token của 1 user (vd sau khi đổi mật khẩu). */
  async revokeAll(userId: string): Promise<void> {
    const keys = await this.redis.keys(this.key(userId, '*'));
    await this.redis.del(...keys);
  }

  private async verify(token: string): Promise<RefreshPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  private key(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }
}
