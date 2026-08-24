import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { SellerAuction } from '../../types/auction';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { useAuctionRealtime } from '../../realtime/hooks/useAuctionRealtime';

function statusTone(status: SellerAuction['status']) {
  if (status === 'ACTIVE') return 'mint' as const;
  if (status === 'AWAITING_PAYMENT') return 'coral' as const;
  if (status === 'COMPLETED') return 'blue' as const;
  return 'neutral' as const;
}

export function AuctionOperationsCard({
  auction,
  detailPath,
  footer,
}: {
  auction: SellerAuction;
  detailPath: string;
  footer?: ReactNode;
}) {
  useAuctionRealtime(auction.id, auction.productId);
  return (
    <Card className="overflow-hidden p-0">
      <Link to={detailPath} className="block bg-cream/50 p-4 hover:bg-cream">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-navy">{auction.productName}</p>
            <p className="mt-1 text-xs text-navy/50">Ends {new Date(auction.endsAt).toLocaleString()}</p>
          </div>
          <Badge tone={statusTone(auction.status)}>{auction.status.replaceAll('_', ' ')}</Badge>
        </div>
      </Link>
      <div className="grid grid-cols-3 gap-3 p-4 text-sm">
        <div><p className="text-xs text-navy/45">Current</p><p className="font-mono font-semibold text-navy">${auction.currentPrice}</p></div>
        <div><p className="text-xs text-navy/45">Bids</p><p className="font-mono font-semibold text-navy">{auction.bidCount}</p></div>
        <div><p className="text-xs text-navy/45">Next</p><p className="font-mono font-semibold text-navy">${auction.minNextBid}</p></div>
      </div>
      {footer}
    </Card>
  );
}
