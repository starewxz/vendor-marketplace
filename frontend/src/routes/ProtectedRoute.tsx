import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import type { UserRole } from '../types/user';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * Redirects to /login when no token is present. Role checks are best-effort
 * until Stage 2 hydrates the real user — treated as a UX nicety here, not a
 * security boundary (the backend is the actual gate).
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
