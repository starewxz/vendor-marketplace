import { createContext } from 'react';
import type { AuthenticatedUser } from '../../types/user';

export interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
