import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { getApiErrorMessage } from '../../api/error';
import { useAuth } from '../../features/auth/useAuth';
import {
  useAuctionCheckout,
  useBidHistory,
  usePlaceBid,
  useProductAuction,
  useWinnerState,
} from '../../features/auctions/hooks';
import { useAuctionRealtime } from '../../realtime/hooks/useAuctionRealtime';
import { useRealtime } from '../../realtime/useRealtime';

function remainingLabel(target: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  return `${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function AuctionPanel({ productId }: { productId: string }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const auctionQuery = useProductAuction(productId);
  const auction = auctionQuery.data;
  const history = useBidHistory(auction?.id);
  const winner = useWinnerState(auction?.id, isAuthenticated && user?.role === 'CUSTOMER');
  const bid = usePlaceBid(auction?.id ?? '');
  const checkout = useAuctionCheckout(auction?.id ?? '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const { status: realtimeStatus } = useRealtime();
  useAuctionRealtime(auction?.id, productId);

  useEffect(() => {
    const immediate = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, []);

  const clock = useMemo(() => {
    if (!auction) return '';
    if (auction.status === 'SCHEDULED') return `Starts in ${remainingLabel(auction.startsAt, now)}`;
    if (auction.status === 'ACTIVE') return `Closes in ${remainingLabel(auction.endsAt, now)}`;
    if (winner.data?.canCheckout && winner.data.purchaseWindowEndsAt) {
      return `Purchase window ${remainingLabel(winner.data.purchaseWindowEndsAt, now)}`;
    }
    return 'Bidding closed';
  }, [auction, now, winner.data]);

  if (auctionQuery.isLoading) return <Spinner label="Loading auction…" />;
  if (auctionQuery.isError || !auction) {
    return (
      <div className="rounded-2xl border border-line bg-cream/40 p-4 text-sm text-navy/60">
        This seller has not configured bidding for this item yet.
      </div>
    );
  }
  const defaultBid = auction.minNextBid;

  function submitBid(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/product/${productId}` } } });
      return;
    }
    setError(null);
    bid.mutate(
      { amount: amount || defaultBid, key: crypto.randomUUID() },
      { onError: (cause) => setError(getApiErrorMessage(cause, 'This bid was not accepted.')) },
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
      <div className="bg-sunny px-5 py-4 text-navy">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone={auction.status === 'ACTIVE' ? 'coral' : 'neutral'}>
              {auction.status === 'ACTIVE'
                ? 'Live auction'
                : auction.status.replaceAll('_', ' ')}
            </Badge>
            <span className="text-xs font-medium text-navy/55">
              {realtimeStatus === 'live'
                ? '● Live updates'
                : realtimeStatus === 'reconnecting' || realtimeStatus === 'connecting'
                  ? '○ Reconnecting…'
                  : '○ Offline — updates may be delayed'}
            </span>
          </div>
          <span className="font-mono text-sm font-semibold">{clock}</span>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-navy/55">Current bid</p>
        <p className="font-mono text-4xl font-bold tracking-tight">${auction.currentPrice}</p>
        <p className="text-sm text-navy/65">{auction.bidCount} bid{auction.bidCount === 1 ? '' : 's'} · next bid ${auction.minNextBid}</p>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {auction.status === 'ACTIVE' && user?.role !== 'SELLER' && user?.role !== 'ADMIN' && (
          <form onSubmit={submitBid} className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="bid-amount" className="mb-1 block text-xs font-medium text-navy/60">Your bid</label>
              <Input id="bid-amount" value={amount || auction.minNextBid} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
            </div>
            <Button type="submit" disabled={bid.isPending}>{bid.isPending ? 'Checking bid…' : 'Place bid'}</Button>
          </form>
        )}

        {winner.data?.isWinner && (
          <div className="rounded-xl border border-mint/40 bg-mint/10 p-4">
            <p className="font-semibold text-navy">You won this auction</p>
            <p className="text-sm text-navy/65">Complete the purchase at ${auction.currentPrice} before the clock runs out.</p>
            <Button
              className="mt-3"
              disabled={!winner.data.canCheckout || checkout.isPending}
              onClick={() => checkout.mutate(crypto.randomUUID(), {
                onSuccess: (result) => navigate(`/account/orders/${result.orderId}`),
                onError: (cause) => setError(getApiErrorMessage(cause, 'Purchase could not be completed.')),
              })}
            >
              {checkout.isPending ? 'Creating order…' : 'Complete purchase'}
            </Button>
          </div>
        )}

        {bid.isSuccess && <p className="text-sm font-medium text-crew-blue">Bid accepted at ${bid.data.amount}. You’re in front.</p>}
        {error && <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-navy/45">Recent bids</p>
          {history.data?.length ? (
            <ul className="divide-y divide-line text-sm">
              {history.data.slice(0, 5).map((item) => (
                <li key={item.id} className="flex justify-between py-2">
                  <span className="text-navy/60">{item.isMine ? 'Your bid' : item.bidderLabel}</span>
                  <span className="font-mono font-semibold text-navy">${item.amount}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-navy/50">No bids yet. The opening move is yours.</p>}
        </div>
      </div>
    </section>
  );
}
