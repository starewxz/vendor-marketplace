import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function RegisterPage() {
  const [notice, setNotice] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-navy">Join the crew</h1>
        <p className="text-sm text-navy/60">Create an account to shop or start selling.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input id="firstName" label="First name" required />
          <Input id="lastName" label="Last name" required />
        </div>
        <Input id="email" type="email" label="Email" placeholder="you@example.com" required />
        <Input id="password" type="password" label="Password" placeholder="••••••••" required />
        <Button type="submit">Create account</Button>
      </form>

      {notice && (
        <p className="rounded-xl bg-cream px-3 py-2 text-sm text-navy/70">
          Registration isn't wired up yet — this form is the real UI shell, backend logic lands in Stage 2.
        </p>
      )}

      <p className="text-center text-sm text-navy/60">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-crew-blue">
          Log in
        </Link>
      </p>
    </div>
  );
}
