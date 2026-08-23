import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function LoginPage() {
  const [notice, setNotice] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-navy">Welcome back</h1>
        <p className="text-sm text-navy/60">Log in to track orders and manage your stall.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="email" type="email" label="Email" placeholder="you@example.com" required />
        <Input id="password" type="password" label="Password" placeholder="••••••••" required />
        <Button type="submit">Log in</Button>
      </form>

      {notice && (
        <p className="rounded-xl bg-cream px-3 py-2 text-sm text-navy/70">
          Login isn't wired up yet — email/password and Google OAuth land in Stage 2. This form is the real UI shell.
        </p>
      )}

      <p className="text-center text-sm text-navy/60">
        New to Cargo Crew?{' '}
        <Link to="/register" className="font-semibold text-crew-blue">
          Create an account
        </Link>
      </p>
    </div>
  );
}
