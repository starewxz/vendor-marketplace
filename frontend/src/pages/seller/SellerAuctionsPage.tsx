import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function SellerAuctionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Your auctions</h1>
      <NotYetAvailable feature="Auction management" />
    </div>
  );
}
