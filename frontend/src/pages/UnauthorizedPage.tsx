import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="font-mono text-sm font-semibold tracking-widest text-navy/40 uppercase">403</span>
      <h1 className="font-display text-2xl font-semibold text-navy">This dock is off-limits</h1>
      <p className="max-w-sm text-sm text-navy/60">
        Your account doesn't have access to this area of Cargo Crew.
      </p>
      <Link to="/">
        <Button>Back to the marketplace</Button>
      </Link>
    </div>
  );
}
