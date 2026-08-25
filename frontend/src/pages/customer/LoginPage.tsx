import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleLoginButton } from '../../components/ui/GoogleLoginButton';
import { useAuth } from '../../features/auth/useAuth';
import { getApiErrorMessage } from '../../api/error';

// The backend's Google OAuth callback redirects here (full page navigation,
// not a fetch call) with this flag on failure — e.g. an unverified Google
// email — since it can't hand the frontend a normal caught exception.
const GOOGLE_OAUTH_ERROR_MESSAGE =
  'Google sign-in failed. Please try again or use email/password.';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('error') === 'google_oauth_failed'
      ? GOOGLE_OAUTH_ERROR_MESSAGE
      : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectFrom = (location.state as { from?: Location } | null)?.from?.pathname;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/account';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold text-navy">Welcome back</h1>
        <p className="text-sm text-navy/60">
          {redirectFrom ? 'Sign in to continue where you left off.' : 'Log in to track orders and manage your stall.'}
        </p>
      </div>

      <GoogleLoginButton />
      <div className="flex items-center gap-3 text-xs font-medium text-navy/40">
        <div className="h-px flex-1 bg-line" />
        or
        <div className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="text-center text-sm text-navy/60">
        New to Cargo Crew?{' '}
        <Link to="/register" className="font-semibold text-crew-blue">
          Create an account
        </Link>
      </p>
    </div>
  );
}
