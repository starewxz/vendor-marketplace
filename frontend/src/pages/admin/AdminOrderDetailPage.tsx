import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAdminOrder } from '../../features/adminOrders/hooks';
import { formatStatusLabel, ORDER_STATUS_TONE } from '../../features/sellerOrders/status';
import { AdminSellerOrderCard } from '../../components/admin/AdminSellerOrderCard';

export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, isError } = useAdminOrder(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner label="Loading order…" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <EmptyState
        title="We couldn't find that order"
        action={
          <Link to="/admin/orders">
            <Badge tone="blue">Back to all orders</Badge>
          </Link>
        }
      />
    );
  }

  const address = [
    order.shippingAddressLine1,
    order.shippingAddressLine2,
    order.shippingCity,
    order.shippingPostalCode,
    order.shippingCountry,
  ]
    .filter(Boolean)
    .join(', ');

  const hasRefunds = order.originalTotal !== order.effectiveTotal;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-navy/60">
            Buyer {order.buyerId} · {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge tone={ORDER_STATUS_TONE[order.status]}>{formatStatusLabel(order.status)}</Badge>
      </div>

      {address && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-navy">Shipping to</p>
          <p className="text-sm text-navy/70">{address}</p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {order.sellerOrders.map((sellerOrder) => (
          <AdminSellerOrderCard key={sellerOrder.id} sellerOrder={sellerOrder} parentOrderId={order.id} />
        ))}
      </div>

      <Card className="flex flex-col gap-2 p-5">
        {hasRefunds && (
          <>
            <div className="flex justify-between text-sm text-navy/60">
              <span>Original total</span>
              <span>${order.originalTotal}</span>
            </div>
            <div className="flex justify-between text-sm text-coral">
              <span>Refunded</span>
              <span>−${order.refundedTotal}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-t border-line pt-2">
          <p className="font-display text-lg font-semibold text-navy">Effective order total</p>
          <p className="font-display text-xl font-semibold text-navy">${order.effectiveTotal}</p>
        </div>
      </Card>
    </div>
  );
}
