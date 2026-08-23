import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { Spinner } from '../components/ui/Spinner';
import type { UserRole } from '../types/user';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * Waits for the initial session-restoration attempt (see AuthProvider)
 * before deciding to redirect — otherwise a valid session looks logged-out
 * for the split second before /auth/refresh resolves on page load.
 *
 * This is UX only. The backend's JwtAuthGuard/RolesGuard are the actual
 * security boundary — a user who bypasses this component still can't call
 * a protected API without a valid token and the right role.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Loading session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
