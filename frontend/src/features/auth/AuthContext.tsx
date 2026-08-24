import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context';
import { setAccessToken, subscribeAccessToken } from './token-storage';
import * as authApi from '../../api/auth';
import type { AuthenticatedUser } from '../../types/user';

/**
 * On mount, attempts silent session restoration via POST /auth/refresh,
 * which succeeds or fails based solely on the httpOnly refresh cookie —
 * there's nothing in JS-accessible storage to check first. A 401 here just
 * means "no session," not an error to surface to the user.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    authApi
      .refresh()
      .then((res) => {
        if (cancelled) return;
        setAccessToken(res.accessToken);
        setUser(res.user);
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeAccessToken((token) => {
    if (token === null && !isInitializing) setUser(null);
  }), [isInitializing]);

  const login = useCallback(async (input: authApi.LoginInput) => {
    const res = await authApi.login(input);
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const register = useCallback(async (input: authApi.RegisterInput) => {
    const res = await authApi.register(input);
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const res = await authApi.refresh();
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitializing,
      login,
      register,
      logout,
      refreshSession,
    }),
    [user, isInitializing, login, register, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
