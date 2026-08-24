import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { useAdminAnalytics } from '../../features/analytics/hooks';

const money = (value: string) => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function AdminOverviewPage() {
  const analytics = useAdminAnalytics();

  if (analytics.isLoading) return <Spinner label="Preparing control room…" />;
  if (analytics.isError || !analytics.data) {
    return <EmptyState title="Control room unavailable" description="Operational routes remain available from the navigation." />;
  }
  const { summary, topSellers } = analytics.data;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy">Control room</h1>
        <p className="text-sm text-navy/60">Marketplace health at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Marketplace sales" value={money(summary.grossSales)} />
        <StatCard label="Platform revenue" value={money(summary.platformRevenue)} />
        <StatCard label="Orders" value={String(summary.orders)} />
        <StatCard label="Refunds" value={money(summary.refunds)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold text-navy">Top seller manifests</h2><Link to="/admin/analytics" className="text-sm font-semibold text-crew-blue">Full analytics →</Link></div>
          <div className="mt-3 divide-y divide-line">
            {topSellers.slice(0, 5).map((seller, index) => <div key={seller.sellerId} className="flex justify-between py-3 text-sm"><span><strong className="mr-2 text-cargo-yellow-dark">#{index + 1}</strong>{seller.storeName}</span><span className="font-mono">{money(seller.net)}</span></div>)}
            {!topSellers.length && <p className="py-8 text-center text-sm text-navy/50">Delivered sales will populate this list.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold text-navy">Operations</h2>
          <div className="mt-3 grid gap-2">
            {[['Seller applications', '/admin/sellers'], ['Orders & refunds', '/admin/orders'], ['Auction oversight', '/admin/auctions'], ['Dispute control', '/admin/disputes']].map(([label, to]) => <Link key={to} to={to} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-navy hover:border-crew-blue hover:bg-cream">{label}<span className="float-right text-crew-blue">→</span></Link>)}
          </div>
        </Card>
      </div>
    </div>
  );
}
