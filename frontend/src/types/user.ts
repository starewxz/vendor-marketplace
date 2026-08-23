export type UserRole = 'CUSTOMER' | 'SELLER' | 'ADMIN';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}
