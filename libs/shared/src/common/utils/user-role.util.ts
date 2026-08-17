import { AuthenticatedUser } from '../interfaces/api-response.interface';

/** Role dùng trong hệ thống — khớp enum `ERole` của auth-service. */
export const ROLE_ADMIN = 'ADMIN';
export const ROLE_USER = 'USER';

/**
 * Kiểm tra user có role hay không.
 *
 * Vì sao cần helper cho một dòng `includes`: token do auth-service ký mang
 * `role` (CHUỖI), còn `JwtAuthGuard` chuẩn hoá vào `request.user.roles` (MẢNG).
 * Hai tên gần giống nhau nên rất dễ viết nhầm `user.role === 'ADMIN'` —
 * TypeScript KHÔNG bắt được (interface có index signature `[key: string]: unknown`),
 * và hậu quả là điều kiện luôn sai: admin bị coi như khách thường.
 * Có helper thì chỉ còn MỘT cách đúng để hỏi.
 */
export function hasRole(
  user: AuthenticatedUser | undefined,
  role: string,
): boolean {
  return user?.roles?.includes(role) ?? false;
}

/** Đường tắt cho trường hợp dùng nhiều nhất. */
export function isAdmin(user: AuthenticatedUser | undefined): boolean {
  return hasRole(user, ROLE_ADMIN);
}
