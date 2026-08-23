import { StatCard } from '../../components/ui/StatCard';
import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy">Control room</h1>
        <p className="text-sm text-navy/60">Marketplace health at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total sellers" value="0" />
        <StatCard label="Pending applications" value="0" />
        <StatCard label="Open disputes" value="0" />
        <StatCard label="GMV this month" value="$0.00" />
      </div>

      <NotYetAvailable feature="Platform analytics" />
    </div>
  );
}
