import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { SearchBar } from './SearchBar';
import { CategoryChips } from './CategoryChips';
import { useAuth } from '../../features/auth/useAuth';

export function MarketplaceHeader() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-paper">
      <div className="bg-navy px-4 py-1.5 text-center text-xs font-medium text-cargo-yellow sm:px-6">
        Free shipping on your first crate. Every seller ships from their own stall.
      </div>

      <div className="border-b border-line px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Logo />
          <SearchBar />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              to="/seller"
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-navy hover:bg-cream sm:inline-flex"
            >
              Sell on Cargo Crew
            </Link>
            <Link
              to="/cart"
              aria-label="Cart"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy hover:bg-cream"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cart
            </Link>
            <Link
              to={isAuthenticated ? '/account' : '/login'}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy hover:bg-cream"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {isAuthenticated ? 'Account' : 'Log in'}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        <CategoryChips />
      </div>
    </header>
  );
}
