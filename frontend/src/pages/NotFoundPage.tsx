import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="font-mono text-sm font-semibold tracking-widest text-navy/40 uppercase">404</span>
      <h1 className="font-display text-2xl font-semibold text-navy">This crate never arrived</h1>
      <p className="max-w-sm text-sm text-navy/60">
        The page you're looking for got lost somewhere between the dock and here.
      </p>
      <Link to="/">
        <Button>Back to the marketplace</Button>
      </Link>
    </div>
  );
}
