import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { useAdminAuctions } from '../../features/auctions/hooks';
import { Link } from 'react-router-dom';

export function AdminAuctionsPage() {
  const query = useAdminAuctions();
  if (query.isLoading) return <Spinner label="Loading auctions…" />;
  if (query.isError) return <EmptyState title="Couldn't load auctions" description="Check the backend connection and try again." />;
  return <div className="flex flex-col gap-4"><div><h1 className="font-display text-2xl font-semibold text-navy">Auction oversight</h1><p className="text-sm text-navy/55">Read-only operational view for this stage.</p></div>
    {!query.data?.data.length ? <EmptyState title="No auctions" description="Seller auctions will appear here." /> : <div className="overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full text-left text-sm"><thead className="bg-cream/60 text-xs uppercase tracking-wide text-navy/50"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Current bid</th><th className="px-4 py-3">Bids</th><th className="px-4 py-3">Deadline</th></tr></thead><tbody className="divide-y divide-line">{query.data.data.map((auction) => <tr key={auction.id}><td className="px-4 py-3 font-medium text-navy"><Link className="hover:text-crew-blue hover:underline" to={`/admin/auctions/${auction.id}`}>{auction.productName}</Link></td><td className="px-4 py-3"><Badge tone={auction.status === 'ACTIVE' ? 'mint' : 'neutral'}>{auction.status.replaceAll('_', ' ')}</Badge></td><td className="px-4 py-3 font-mono">${auction.currentPrice}</td><td className="px-4 py-3">{auction.bidCount}</td><td className="px-4 py-3 text-navy/60">{new Date(auction.endsAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
  </div>;
}
