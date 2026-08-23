import { DashboardShell } from '../components/layout/DashboardShell';

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/sellers', label: 'Sellers' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/disputes', label: 'Disputes' },
  { to: '/admin/analytics', label: 'Analytics' },
];

export function AdminLayout() {
  return <DashboardShell navItems={ADMIN_NAV_ITEMS} roleLabel="Admin control room" />;
}
