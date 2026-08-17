import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../constants/metadata.constants';
import { AuthenticatedUser } from '../interfaces/api-response.interface';

/** Payload access token do auth-service ký (xem TokenService.issueTokens). */
interface AccessTokenPayload {
  sub: string;
  email?: string | null;
  role?: string | null;
}

/**
 * Verify access token TẬP TRUNG Ở GATEWAY.
 *
 * Vì sao gateway verify được token do auth-service ký mà không cần hỏi ai:
 * JWT là chữ ký số — chỉ cần CÙNG `JWT_SECRET` là kiểm tra được tính toàn vẹn,
 * không cần round-trip qua RMQ. Nhờ vậy request thiếu/sai token bị chặn ngay ở
 * cửa, các service phía sau KHÔNG hề bị đánh thức (đúng bài API Gateway).
 *
 * Không dùng passport-jwt: gateway chỉ cần verify chữ ký + gắn user vào request
 * (~30 dòng). Thêm passport là thêm 3 dependency và một tầng "phép thuật" che
 * mất chính thứ đang cần học. Đổi sang passport sau này cũng chỉ đụng file này.
 *
 * Đăng ký global ở gateway:
 * ```ts
 * { provide: APP_GUARD, useClass: JwtAuthGuard }
 * ```
 * Route công khai (login/register/docs) đánh dấu bằng `@Public()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Thiếu access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      // Không phân biệt "sai chữ ký" với "hết hạn" trong message trả về —
      // càng ít thông tin cho kẻ dò càng tốt.
      throw new UnauthorizedException(
        'Access token không hợp lệ hoặc đã hết hạn',
      );
    }

    // Chuẩn hoá: auth-service ký `role` (1 chuỗi), RolesGuard đọc `roles` (mảng).
    // Quy về 1 dạng ngay tại đây để phía sau không phải nhớ 2 kiểu.
    request.user = {
      sub: payload.sub,
      email: payload.email ?? undefined,
      roles: payload.role ? [payload.role] : [],
    };

    return true;
  }

  /** Lấy token từ header `Authorization: Bearer <token>`. */
  private extractToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}
