import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { Spinner } from '../../components/ui/Spinner';

/**
 * Landing point after the backend's Google OAuth callback redirect. That
 * redirect is a full page navigation, so AuthProvider's mount-time
 * /auth/refresh call runs fresh here and picks up the session cookie the
 * backend just set — this page just waits for that and then moves on.
 */
export function AuthCallbackPage() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Finishing sign-in…" />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/account' : '/login'} replace />;
}
