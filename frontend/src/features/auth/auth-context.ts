import { createContext } from 'react';
import type { AuthenticatedUser } from '../../types/user';
import type { LoginInput, RegisterInput } from '../../api/auth';

export interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  /** True until the initial session-restoration attempt (via /auth/refresh) resolves. */
  isInitializing: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-issues an access token from the current DB state — e.g. after a
   * seller application is approved mid-session, so role changes apply
   * without forcing a full logout/login. */
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
