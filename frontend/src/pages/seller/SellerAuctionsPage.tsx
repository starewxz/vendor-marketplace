import { useMemo, useState, type FormEvent } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../api/error';
import { useMyProducts } from '../../features/sellerProducts/hooks';
import { useCancelAuction, useCreateAuction, useSellerAuctions } from '../../features/auctions/hooks';

function localDate(minutesFromNow: number) {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function SellerAuctionsPage() {
  const auctions = useSellerAuctions();
  const products = useMyProducts();
  const create = useCreateAuction();
  const cancel = useCancelAuction();
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState('');
  const [startPrice, setStartPrice] = useState('10.00');
  const [increment, setIncrement] = useState('1.00');
  const [startsAt, setStartsAt] = useState(localDate(1));
  const [endsAt, setEndsAt] = useState(localDate(24 * 60));
  const [error, setError] = useState<string | null>(null);

  const configured = useMemo(() => new Set(auctions.data?.map((item) => item.productId)), [auctions.data]);
  const eligible = useMemo(
    () => products.data?.filter((product) => product.type === 'AUCTION' && !configured.has(product.id)) ?? [],
    [products.data, configured],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    create.mutate({
      productId,
      startPrice,
      minBidIncrement: increment,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    }, {
      onSuccess: () => setShowForm(false),
      onError: (cause) => setError(getApiErrorMessage(cause, 'Auction could not be created.')),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-semibold text-navy">Auction desk</h1><p className="text-sm text-navy/55">Set the opening bell, then let buyers do the talking.</p></div>
        <Button onClick={() => setShowForm((value) => !value)}>{showForm ? 'Close form' : 'Configure auction'}</Button>
      </div>

      {showForm && <Card className="border-sunny/60 p-5">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-navy">Auction product<select className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" value={productId} onChange={(e) => setProductId(e.target.value)} required><option value="">Choose an auction product</option>{eligible.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <Input id="start-price" label="Start price" value={startPrice} onChange={(e) => setStartPrice(e.target.value)} required />
          <Input id="increment" label="Minimum increment" value={increment} onChange={(e) => setIncrement(e.target.value)} required />
          <Input id="starts-at" label="Starts at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          <Input id="ends-at" label="Ends at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
          <div className="flex items-end"><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Scheduling…' : 'Schedule auction'}</Button></div>
        </form>
        {eligible.length === 0 && <p className="mt-3 text-sm text-navy/55">Create an AUCTION-type product first, or every eligible product is already configured.</p>}
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
      </Card>}

      {auctions.isLoading && <Spinner label="Loading auctions…" />}
      {auctions.isError && <EmptyState title="Couldn't load auctions" description="Try refreshing this page." />}
      {!auctions.isLoading && auctions.data?.length === 0 && <EmptyState title="No auctions configured" description="Create an auction-type product, then set its bidding window here." />}
      <div className="grid gap-4 lg:grid-cols-2">{auctions.data?.map((auction) => <Card key={auction.id} className="overflow-hidden p-0">
        <div className="flex items-start justify-between bg-cream/50 p-4"><div><p className="font-semibold text-navy">{auction.productName}</p><p className="text-xs text-navy/50">Ends {new Date(auction.endsAt).toLocaleString()}</p></div><Badge tone={auction.status === 'ACTIVE' ? 'mint' : auction.status === 'AWAITING_PAYMENT' ? 'coral' : 'neutral'}>{auction.status.replaceAll('_', ' ')}</Badge></div>
        <div className="grid grid-cols-3 gap-3 p-4 text-sm"><div><p className="text-xs text-navy/45">Current</p><p className="font-mono font-semibold text-navy">${auction.currentPrice}</p></div><div><p className="text-xs text-navy/45">Bids</p><p className="font-mono font-semibold text-navy">{auction.bidCount}</p></div><div><p className="text-xs text-navy/45">Next</p><p className="font-mono font-semibold text-navy">${auction.minNextBid}</p></div></div>
        {(auction.status === 'ACTIVE' || auction.status === 'SCHEDULED') && <div className="border-t border-line px-4 py-3"><Button size="sm" variant="danger" disabled={cancel.isPending} onClick={() => confirm('Cancel this auction?') && cancel.mutate(auction.id)}>Cancel auction</Button></div>}
      </Card>)}</div>
    </div>
  );
}
