import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useMySellerOrders } from '../../features/sellerOrders/hooks';

const STATUS_TONE: Record<string, 'yellow' | 'blue' | 'coral' | 'mint' | 'neutral'> = {
  AWAITING_FULFILLMENT: 'yellow',
  PROCESSING: 'blue',
  SHIPPED: 'blue',
  DELIVERED: 'mint',
  CANCELLED: 'coral',
  REFUNDED: 'coral',
};

export function SellerOrdersPage() {
  const { data, isLoading, isError } = useMySellerOrders();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Your orders</h1>

      {isLoading && <Spinner label="Loading your orders…" />}
      {isError && <EmptyState title="Couldn't load your orders" description="Try refreshing the page." />}
      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState title="No orders yet" description="Orders for your products will show up here." />
      )}

      <div className="flex flex-col gap-3">
        {data?.items.map((sellerOrder) => (
          <Link key={sellerOrder.id} to={`/seller/orders/${sellerOrder.id}`}>
            <Card className="flex items-center justify-between gap-4 p-4 hover:border-navy/30">
              <div>
                <p className="font-semibold text-navy">Order #{sellerOrder.id.slice(0, 8)}</p>
                <p className="text-sm text-navy/60">
                  {new Date(sellerOrder.createdAt).toLocaleDateString()} · {sellerOrder.itemCount} item(s)
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Badge tone={STATUS_TONE[sellerOrder.status] ?? 'neutral'}>
                  {sellerOrder.status.replace(/_/g, ' ')}
                </Badge>
                <div className="text-right">
                  <p className="font-semibold text-navy">${sellerOrder.sellerNetAmount} net</p>
                  <p className="text-xs text-navy/50">${sellerOrder.subtotal} − ${sellerOrder.commissionAmount} fee</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
