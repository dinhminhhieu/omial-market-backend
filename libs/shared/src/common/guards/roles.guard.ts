import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../constants/metadata.constants';
import { AuthenticatedUser } from '../interfaces/api-response.interface';

/**
 * Kiểm tra role của user (đã được auth guard gắn vào `request.user`)
 * so với `@Roles(...)` khai báo trên handler/controller.
 *
 * - Route `@Public()` hoặc không khai báo `@Roles()` => cho qua.
 * - Chưa có user hoặc thiếu role phù hợp => 403.
 *
 * Lưu ý: guard này KHÔNG tự xác thực JWT. Hãy chạy sau một AuthGuard
 * (vd JwtAuthGuard) để `request.user` đã được điền.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const userRoles = request.user?.roles ?? [];

    const allowed = requiredRoles.some((role) => userRoles.includes(role));
    if (!allowed) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập tài nguyên này',
      );
    }

    return true;
  }
}
