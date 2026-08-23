import { StatCard } from '../../components/ui/StatCard';
import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function SellerOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy">Stall overview</h1>
        <p className="text-sm text-navy/60">A snapshot of how your stall is doing.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active listings" value="0" />
        <StatCard label="Open orders" value="0" />
        <StatCard label="Live auctions" value="0" />
        <StatCard label="Net this month" value="$0.00" />
      </div>

      <NotYetAvailable feature="Seller analytics" />
    </div>
  );
}
