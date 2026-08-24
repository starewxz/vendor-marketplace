import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { SearchBar } from './SearchBar';
import { CategoryChips } from './CategoryChips';
import { useAuth } from '../../features/auth/useAuth';
import { useCart } from '../../features/cart/hooks';
import { ConnectionPill } from '../realtime/ConnectionPill';

export function MarketplaceHeader() {
  const { isAuthenticated, user } = useAuth();
  const { data: cart } = useCart(isAuthenticated && user?.role === 'CUSTOMER');

  const roleEntry = user?.role === 'ADMIN'
    ? { to: '/admin', label: 'Admin' }
    : user?.role === 'SELLER'
      ? { to: '/seller', label: 'Seller stall' }
      : { to: '/account/seller', label: 'Sell' };

  return (
    <header className="sticky top-0 z-30 bg-paper">
      <div className="bg-navy px-4 py-1.5 text-center text-xs font-medium text-cargo-yellow sm:px-6">
        <span>Free shipping on your first crate. Every seller ships from their own stall.</span>
        <span className="ml-3 hidden rounded-full bg-paper px-2 py-0.5 sm:inline-flex"><ConnectionPill /></span>
      </div>

      <div className="border-b border-line px-4 py-3 sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-3 md:flex md:gap-4">
          <Logo />
          <div className="order-3 col-span-2 md:order-none md:col-span-1 md:flex-1"><SearchBar /></div>
          <div className="ml-auto flex shrink-0 items-center gap-0 sm:gap-1">
            <Link
              to={roleEntry.to}
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-navy hover:bg-cream sm:inline-flex"
            >
              {roleEntry.label}
            </Link>
            <Link
              to="/cart"
              aria-label="Cart"
              className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy hover:bg-cream"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Cart</span>
              {Boolean(cart?.itemCount) && (
                <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-paper">
                  {cart!.itemCount}
                </span>
              )}
            </Link>
            <Link
              to={isAuthenticated ? '/account' : '/login'}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy hover:bg-cream"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="hidden sm:inline">{isAuthenticated ? 'Account' : 'Log in'}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        <nav aria-label="Marketplace" className="flex items-center gap-1 overflow-x-auto px-4 pt-2 sm:px-6">
          <Link to="/" className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-navy hover:bg-cream">Home</Link>
          <Link to="/catalog" className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-navy hover:bg-cream">Catalog</Link>
          <Link to="/catalog?type=AUCTION" className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-navy hover:bg-cream">Auctions</Link>
          {user?.role === 'CUSTOMER' && <Link to="/account/orders" className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-navy hover:bg-cream">Orders</Link>}
        </nav>
        <CategoryChips />
      </div>
    </header>
  );
}
