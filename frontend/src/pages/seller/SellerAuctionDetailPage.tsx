import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuctionOperationsCard } from '../../components/auction/AuctionOperationsCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../api/error';
import { useBidHistory, useSellerAuction, useUpdateAuction } from '../../features/auctions/hooks';

export function SellerAuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const auction = useSellerAuction(id);
  const history = useBidHistory(id);
  const update = useUpdateAuction();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auction.isLoading) return <Spinner label="Opening auction manifest…" />;
  if (auction.isError || !auction.data) {
    return <EmptyState title="Auction not found" description="It may not belong to this seller account." />;
  }

  const data = auction.data;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError(null);
    update.mutate(
      {
        id: data.id,
        input: {
          startPrice: String(values.get('startPrice')),
          minBidIncrement: String(values.get('minBidIncrement')),
          startsAt: new Date(String(values.get('startsAt'))).toISOString(),
          endsAt: new Date(String(values.get('endsAt'))).toISOString(),
        },
      },
      {
        onSuccess: () => setEditing(false),
        onError: (cause) => setError(getApiErrorMessage(cause, 'Auction settings could not be saved.')),
      },
    );
  }

  const localDate = (value: string) => {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/seller/auctions" className="text-sm font-semibold text-crew-blue">← Auction desk</Link>
          <h1 className="font-display text-2xl font-semibold text-navy">{data.productName}</h1>
          <p className="text-sm text-navy/60">Auction #{data.id.slice(0, 8)}</p>
        </div>
        {data.isEditable && <Button variant="secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'Close editor' : 'Edit schedule'}</Button>}
      </div>

      <AuctionOperationsCard auction={data} detailPath={`/seller/auctions/${data.id}`} />

      {editing && (
        <Card className="p-5">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <Input name="startPrice" label="Start price" type="number" min="0.01" step="0.01" defaultValue={data.startPrice} required />
            <Input name="minBidIncrement" label="Minimum increment" type="number" min="0.01" step="0.01" defaultValue={data.minBidIncrement} required />
            <Input name="startsAt" label="Starts at" type="datetime-local" defaultValue={localDate(data.startsAt)} required />
            <Input name="endsAt" label="Ends at" type="datetime-local" defaultValue={localDate(data.endsAt)} required />
            <div className="flex items-end"><Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save auction'}</Button></div>
          </form>
          {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold text-navy">Bid trail</h2>
        {history.isLoading && <Spinner label="Loading bids…" />}
        {history.isError && <p className="mt-3 text-sm text-coral">Bid history could not be loaded.</p>}
        {!history.isLoading && !history.data?.length && <p className="mt-3 text-sm text-navy/50">No bids have been accepted.</p>}
        <div className="mt-3 divide-y divide-line">
          {history.data?.map((bid) => (
            <div key={bid.id} className="flex justify-between py-3 text-sm">
              <span className="text-navy/60">{bid.bidderLabel} · {new Date(bid.createdAt).toLocaleString()}</span>
              <span className="font-mono font-semibold text-navy">${bid.amount}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
