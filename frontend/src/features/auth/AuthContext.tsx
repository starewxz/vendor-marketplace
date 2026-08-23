import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context';
import { clearAccessToken, getAccessToken } from './token-storage';

/**
 * Foundation only: tracks whether an access token is present so
 * ProtectedRoute has something to check. Stage 2 adds real login/register
 * calls and hydrates `user` from the backend instead of leaving it null.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState(() => Boolean(getAccessToken()));

  const logout = useCallback(() => {
    clearAccessToken();
    setHasToken(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user: null, isAuthenticated: hasToken, logout }),
    [hasToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
