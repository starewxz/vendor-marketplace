import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { SearchBar } from './SearchBar';
import { CategoryChips } from './CategoryChips';
import { useAuth } from '../../features/auth/useAuth';
import { useCart } from '../../features/cart/hooks';

const NAV_LINKS = [
  { to: '/catalog', label: 'Categories' },
  { to: '/catalog?sort=price:asc', label: 'Deals' },
  { to: '/catalog?type=AUCTION', label: 'Auctions' },
  { to: '/catalog?sort=createdAt:desc', label: 'New arrivals' },
];

/**
 * Customer-facing header. Kept to one job: get you to search, your cart,
 * or your account in one glance. Seller/admin dashboard links live in
 * their own role-based layout (see DashboardShell), not here — a shopper
 * shouldn't have to visually filter out operational nav to find "Cart".
 */
export function MarketplaceHeader() {
  const { isAuthenticated, user } = useAuth();
  const { data: cart } = useCart(isAuthenticated && user?.role === 'CUSTOMER');
  const dashboardEntry = user?.role === 'ADMIN'
    ? { to: '/admin', label: 'Admin' }
    : user?.role === 'SELLER'
      ? { to: '/seller', label: 'Seller stall' }
      : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Logo />
        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
          <SearchBar />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 text-navy">
          {dashboardEntry && (
            <Link to={dashboardEntry.to} className="hidden rounded-full px-3 py-2 text-sm font-medium text-navy/60 hover:text-navy sm:inline-flex">
              {dashboardEntry.label}
            </Link>
          )}
          {isAuthenticated && user?.role === 'CUSTOMER' && (
            <Link to="/account/orders" className="hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-cream sm:inline-flex">
              Orders
            </Link>
          )}
          <Link
            to={isAuthenticated ? '/account' : '/login'}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-cream"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="hidden sm:inline">{isAuthenticated ? 'Account' : 'Sign in'}</span>
          </Link>
          <Link
            to="/cart"
            aria-label="Cart"
            className="relative inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-sm font-semibold text-paper hover:bg-navy-soft"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Cart</span>
            {Boolean(cart?.itemCount) && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cargo-yellow px-1 text-[11px] font-bold text-navy">
                {cart!.itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Marketplace" className="flex items-center gap-4 overflow-x-auto px-4 py-2 text-sm sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="shrink-0 font-semibold text-navy/70 hover:text-crew-blue">
                {link.label}
              </Link>
            ))}
          </nav>
          <CategoryChips />
        </div>
      </div>
    </header>
  );
}
