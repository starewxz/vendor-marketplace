import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useMyOrders } from '../../features/orders/hooks';

const STATUS_TONE: Record<string, 'yellow' | 'blue' | 'coral' | 'mint' | 'neutral'> = {
  PENDING_PAYMENT: 'yellow',
  PAID: 'blue',
  PARTIALLY_FULFILLED: 'blue',
  FULFILLED: 'mint',
  CANCELLED: 'coral',
};

export function AccountOrdersPage() {
  const { data, isLoading, isError } = useMyOrders();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Your orders</h1>

      {isLoading && <Spinner label="Loading your orders…" />}
      {isError && <EmptyState title="Couldn't load your orders" description="Try refreshing the page." />}
      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState title="No orders yet" description="Orders you place will show up here." />
      )}

      <div className="flex flex-col gap-3">
        {data?.items.map((order) => (
          <Link key={order.id} to={`/account/orders/${order.id}`}>
            <Card className="flex items-center justify-between gap-4 p-4 hover:border-navy/30">
              <div>
                <p className="font-semibold text-navy">Order #{order.id.slice(0, 8)}</p>
                <p className="text-sm text-navy/60">
                  {new Date(order.createdAt).toLocaleDateString()} · {order.sellerCount} seller(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[order.status] ?? 'neutral'}>{order.status.replace(/_/g, ' ')}</Badge>
                <p className="font-semibold text-navy">${order.totalAmount}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
