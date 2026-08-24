import { useState } from 'react';
import type { AnalyticsPeriodInput } from '../../api/analytics';
import { AnalyticsPeriodPicker } from '../../components/analytics/AnalyticsPeriodPicker';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { useSellerAnalytics } from '../../features/analytics/hooks';

const money = (value: string) => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SellerOverviewPage() {
  const [period, setPeriod] = useState<AnalyticsPeriodInput>({});
  const query = useSellerAnalytics(period);
  if (query.isLoading) return <Spinner label="Counting the cargo…" />;
  if (query.isError || !query.data) return <EmptyState title="Analytics unavailable" description="Orders still work; reporting can be retried shortly." />;
  const { summary, daily, topProducts } = query.data;
  const max = Math.max(1, ...daily.map((day) => Number(day.gross)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[.2em] text-crew-blue">Sales manifest</p><h1 className="font-display text-2xl font-semibold text-navy">Stall overview</h1><p className="text-sm text-navy/60">Ledger-backed figures after refunds and reversals.</p></div>
        <AnalyticsPeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Gross sales" value={money(summary.grossSales)} /><StatCard label="Net revenue" value={money(summary.netRevenue)} /><StatCard label="Commission" value={money(summary.commissionPaid)} /><StatCard label="Refunds" value={money(summary.refundTotal)} /><StatCard label="Seller orders" value={String(summary.sellerOrderCount)} /><StatCard label="Delivered" value={String(summary.completedOrders)} /><StatCard label="Products" value={String(summary.activeProducts)} /><StatCard label="Live auctions" value={String(summary.activeAuctions)} /></div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5"><h2 className="font-display font-semibold text-navy">Daily cargo value</h2><div className="mt-5 flex h-44 items-end gap-1 overflow-hidden">{daily.length ? daily.map((day) => <div key={day.date} className="group flex min-w-3 flex-1 flex-col justify-end" title={`${day.date}: ${money(day.gross)}`}><div className="rounded-t bg-crew-blue transition-colors group-hover:bg-cargo-yellow-dark" style={{ height: `${Math.max(3, Number(day.gross) / max * 100)}%` }} /></div>) : <p className="self-center text-sm text-navy/50">No sales in this period.</p>}</div></Card>
        <Card className="p-5"><h2 className="font-display font-semibold text-navy">Top crates</h2><div className="mt-3 divide-y divide-line">{topProducts.map((product, index) => <div key={`${product.productId}-${index}`} className="flex justify-between gap-3 py-3 text-sm"><span><strong className="mr-2 text-cargo-yellow-dark">#{index + 1}</strong>{product.productName}</span><span className="font-mono">{money(product.sales)}</span></div>)}{!topProducts.length && <p className="py-8 text-center text-sm text-navy/50">No delivered sales yet.</p>}</div></Card>
      </div>
    </div>
  );
}
