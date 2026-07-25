import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/metadata.constants';

/**
 * Khai báo các role được phép truy cập route. Kết hợp với `RolesGuard`.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
