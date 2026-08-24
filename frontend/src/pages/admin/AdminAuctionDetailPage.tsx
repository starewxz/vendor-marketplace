import { Link, useParams } from 'react-router-dom';
import { AuctionOperationsCard } from '../../components/auction/AuctionOperationsCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../api/error';
import { useAdminAuction, useBidHistory, useCancelAdminAuction } from '../../features/auctions/hooks';

export function AdminAuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const auction = useAdminAuction(id);
  const history = useBidHistory(id);
  const cancel = useCancelAdminAuction();

  if (auction.isLoading) return <Spinner label="Loading auction record…" />;
  if (auction.isError || !auction.data) return <EmptyState title="Auction not found" />;
  const data = auction.data;
  const cancellable = data.status === 'SCHEDULED' || data.status === 'ACTIVE';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to="/admin/auctions" className="text-sm font-semibold text-crew-blue">← Auction oversight</Link>
        <h1 className="font-display text-2xl font-semibold text-navy">{data.productName}</h1>
        <p className="text-sm text-navy/60">Auction #{data.id.slice(0, 8)} · Product #{data.productId.slice(0, 8)}</p>
      </div>
      <AuctionOperationsCard
        auction={data}
        detailPath={`/admin/auctions/${data.id}`}
        footer={cancellable ? (
          <div className="border-t border-line px-4 py-3">
            <Button
              size="sm"
              variant="danger"
              disabled={cancel.isPending}
              onClick={() => confirm('Cancel this auction? This follows backend lifecycle rules.') && cancel.mutate(data.id)}
            >
              Cancel auction
            </Button>
          </div>
        ) : undefined}
      />
      {cancel.isError && <p className="text-sm text-coral">{getApiErrorMessage(cancel.error, 'Auction could not be cancelled.')}</p>}
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold text-navy">Public-safe bid history</h2>
        {history.isLoading && <Spinner label="Loading bids…" />}
        {history.isError && <p className="mt-3 text-sm text-coral">Bid history could not be loaded.</p>}
        {!history.isLoading && !history.data?.length && <p className="mt-3 text-sm text-navy/50">No accepted bids.</p>}
        {history.data?.map((bid) => <div key={bid.id} className="flex justify-between border-b border-line py-3 text-sm"><span>{bid.bidderLabel}</span><span className="font-mono">${bid.amount}</span></div>)}
      </Card>
    </div>
  );
}
