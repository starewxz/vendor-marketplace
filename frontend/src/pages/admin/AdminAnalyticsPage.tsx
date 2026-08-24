import { useState } from 'react';
import type { AnalyticsPeriodInput } from '../../api/analytics';
import { downloadAnalyticsCsv, downloadAnalyticsJson } from '../../api/analytics';
import { AnalyticsPeriodPicker } from '../../components/analytics/AnalyticsPeriodPicker';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { useAdminAnalytics } from '../../features/analytics/hooks';

const money = (value: string) => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const change = (value: number | null) => value === null ? 'New baseline' : `${value >= 0 ? '+' : ''}${value}%`;

export function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriodInput>({});
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const query = useAdminAnalytics(period);

  if (query.isLoading) return <Spinner label="Preparing the marketplace ledger…" />;
  if (query.isError || !query.data) return <EmptyState title="Report unavailable" description="Try a different period or refresh the page." />;
  const data = query.data;
  const max = Math.max(1, ...data.dailySales.map((item) => Number(item.gross)));

  async function exportFile(run: () => Promise<void>) {
    setBusy(true);
    setExportError(null);
    try {
      await run();
    } catch {
      setExportError('The report could not be downloaded. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[.2em] text-crew-blue">Marketplace manifest</p><h1 className="font-display text-2xl font-semibold text-navy">Admin analytics</h1><p className="text-sm text-navy/60">Effective ledger values with an equal-length previous-period comparison.</p></div>
        <AnalyticsPeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => void exportFile(() => downloadAnalyticsCsv(period))}>Export CSV</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void exportFile(() => downloadAnalyticsJson(period))}>Export JSON</Button>
        {busy && <span className="text-sm text-navy/50">Preparing download…</span>}
        {exportError && <span className="text-sm text-coral">{exportError}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Platform revenue" value={money(data.summary.platformRevenue)} /><StatCard label="Orders" value={String(data.summary.orders)} /><StatCard label="Gross sales" value={money(data.summary.grossSales)} /><StatCard label="Refunds" value={money(data.summary.refunds)} /></div>
      <Card className="grid gap-4 border-cargo-yellow p-5 md:grid-cols-3"><div><p className="text-xs uppercase text-navy/50">Commission change</p><p className="font-display text-xl text-navy">{change(data.comparison.platformRevenueChangePercent)}</p><p className="text-xs text-navy/50">Previous {money(data.comparison.previousPlatformRevenue)}</p></div><div><p className="text-xs uppercase text-navy/50">Order change</p><p className="font-display text-xl text-navy">{change(data.comparison.ordersChangePercent)}</p><p className="text-xs text-navy/50">Previous {data.comparison.previousOrders}</p></div><div><p className="text-xs uppercase text-navy/50">Cart conversion</p><p className="font-display text-xl text-navy">{data.summary.conversionPercent == null ? '—' : `${data.summary.conversionPercent}%`}</p><p className="text-xs text-navy/50" title={data.conversionDefinition}>Observed fixed-price cart outcomes</p></div></Card>
      <Card className="p-5"><h2 className="font-display font-semibold text-navy">Sales by day</h2>{data.dailySales.length ? <div className="mt-5 flex h-44 items-end gap-1 overflow-hidden">{data.dailySales.map((item) => <div key={item.date} className="flex min-w-3 flex-1 flex-col justify-end" title={`${item.date}: ${money(item.gross)}`}><div className="rounded-t bg-cargo-yellow-dark" style={{ height: `${Math.max(3, Number(item.gross) / max * 100)}%` }} /></div>)}</div> : <p className="py-12 text-center text-sm text-navy/50">No sales in this period.</p>}</Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><h2 className="font-display font-semibold text-navy">Top sellers</h2><div className="divide-y divide-line">{data.topSellers.map((seller, index) => <div className="flex justify-between gap-3 py-3 text-sm" key={seller.sellerId}><span><b className="mr-2 text-crew-blue">#{index + 1}</b>{seller.storeName}</span><span className="font-mono">{money(seller.net)}</span></div>)}{!data.topSellers.length && <p className="py-8 text-center text-sm text-navy/50">No ranked sellers for this period.</p>}</div></Card>
        <Card className="p-5"><h2 className="font-display font-semibold text-navy">Top products</h2><div className="divide-y divide-line">{data.topProducts.map((product, index) => <div className="flex justify-between gap-3 py-3 text-sm" key={`${product.productId}-${index}`}><span><b className="mr-2 text-cargo-yellow-dark">#{index + 1}</b>{product.productName}</span><span className="font-mono">{money(product.sales)}</span></div>)}{!data.topProducts.length && <p className="py-8 text-center text-sm text-navy/50">No ranked products for this period.</p>}</div></Card>
      </div>
    </div>
  );
}
