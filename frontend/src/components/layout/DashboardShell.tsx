import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { Badge } from '../ui/Badge';
import { ConnectionPill } from '../realtime/ConnectionPill';

interface DashboardNavItem {
  to: string;
  label: string;
  end?: boolean;
}

interface DashboardShellProps {
  navItems: DashboardNavItem[];
  roleLabel: string;
}

/**
 * Structural shell shared by the seller and admin areas: fixed sidebar +
 * scrollable content. Both roles get their own thin wrapper layout
 * (SellerLayout / AdminLayout) that just supplies nav items, so adding a
 * new dashboard section later means editing a nav array, not this file.
 */
export function DashboardShell({ navItems, roleLabel }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-cream/30 lg:flex">
      <aside className="border-b border-line bg-white px-4 py-4 lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:gap-6 lg:border-r lg:border-b-0 lg:py-6">
        <div className="flex items-center justify-between gap-3 lg:block">
          <Logo />
          <Badge tone="blue">{roleLabel}</Badge>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:mt-0 lg:flex-col lg:overflow-visible" aria-label={`${roleLabel} navigation`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-cargo-yellow text-navy' : 'text-navy/70 hover:bg-cream'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/" className="mt-auto hidden text-sm font-medium text-navy/50 hover:text-navy lg:block">
          ← Back to marketplace
        </NavLink>
        <div className="mt-4 hidden lg:block"><ConnectionPill /></div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 md:px-10 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
