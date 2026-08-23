import { UserRole } from '../../users/entities/user-role.enum';

/** Access-token JWT payload. Deliberately minimal — anything else needed
 * server-side is looked up fresh from the DB, never trusted from the token
 * beyond identity + role. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
  role: UserRole;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedRequestUser;
  }
}
