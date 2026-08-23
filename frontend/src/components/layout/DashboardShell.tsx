import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { Badge } from '../ui/Badge';

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
    <div className="flex min-h-screen bg-cream/30">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-line bg-white px-4 py-6">
        <Logo />
        <Badge tone="blue">{roleLabel}</Badge>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-cargo-yellow text-navy' : 'text-navy/70 hover:bg-cream'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/" className="mt-auto text-sm font-medium text-navy/50 hover:text-navy">
          ← Back to marketplace
        </NavLink>
      </aside>
      <main className="flex-1 overflow-x-hidden px-6 py-8 md:px-10">
        <Outlet />
      </main>
    </div>
  );
}
