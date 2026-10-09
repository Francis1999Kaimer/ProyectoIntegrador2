import { SetMetadata } from '@nestjs/common';
import { AuthenticationUser, UserSummary } from '../repositories/contracts';
export type Role = 'student' | 'teacher' | 'admin';
export const PUBLIC_ROUTE = 'auth:public';
export const REQUIRED_ROLES = 'auth:roles';
export const PASSWORD_CHANGE_ALLOWED = 'auth:password-change-allowed';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Roles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES, roles);
export const AllowPasswordChange = () => SetMetadata(PASSWORD_CHANGE_ALLOWED, true);
export const isRole = (role: string): role is Role => ['student', 'teacher', 'admin'].includes(role);
export function publicUser(user: AuthenticationUser): UserSummary {
  return {
    id: user.id, username: user.username, email: user.email, role: user.role,
    status: user.status, display_name: user.display_name,
    must_change_password: user.must_change_password
  };
}
export interface AuthRequest {
  headers: { authorization?: string }; user?: UserSummary;
}
