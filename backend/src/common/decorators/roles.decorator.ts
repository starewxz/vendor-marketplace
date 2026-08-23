import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles. Requires RolesGuard (registered
 * globally) and must run after JwtAuthGuard has populated `request.user`.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
