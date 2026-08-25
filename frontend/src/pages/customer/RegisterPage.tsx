import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleLoginButton } from '../../components/ui/GoogleLoginButton';
import { useAuth } from '../../features/auth/useAuth';
import { getApiErrorMessage } from '../../api/error';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(form);
      navigate('/account', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create your account.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold text-navy">Create your account</h1>
        <p className="text-sm text-navy/60">Create an account to shop or start selling.</p>
      </div>

      <GoogleLoginButton />
      <div className="flex items-center gap-3 text-xs font-medium text-navy/40">
        <div className="h-px flex-1 bg-line" />
        or
        <div className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input id="firstName" label="First name" value={form.firstName} onChange={update('firstName')} required />
          <Input id="lastName" label="Last name" value={form.lastName} onChange={update('lastName')} required />
        </div>
        <Input
          id="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={form.email}
          onChange={update('email')}
          required
        />
        <Input
          id="password"
          type="password"
          label="Password"
          placeholder="At least 8 characters, upper + lower + number"
          value={form.password}
          onChange={update('password')}
          minLength={8}
          required
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-sm text-navy/60">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-crew-blue">
          Log in
        </Link>
      </p>
    </div>
  );
}
