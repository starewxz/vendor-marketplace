import { DashboardShell } from '../components/layout/DashboardShell';

const SELLER_NAV_ITEMS = [
  { to: '/seller', label: 'Overview', end: true },
  { to: '/seller/products', label: 'Products' },
  { to: '/seller/orders', label: 'Orders' },
  { to: '/seller/auctions', label: 'Auctions' },
  { to: '/seller/disputes', label: 'Disputes' },
];

export function SellerLayout() {
  return <DashboardShell navItems={SELLER_NAV_ITEMS} roleLabel="Seller stall" />;
}
