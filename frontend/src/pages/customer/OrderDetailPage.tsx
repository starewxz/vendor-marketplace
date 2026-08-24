import { Link, useLocation, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useMyOrder } from '../../features/orders/hooks';
import { formatStatusLabel, ORDER_STATUS_TONE, SELLER_ORDER_STATUS_TONE } from '../../features/sellerOrders/status';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, isError } = useMyOrder(id);
  const location = useLocation();
  const justPlaced = Boolean((location.state as { justPlaced?: boolean } | null)?.justPlaced);

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
        description="It may not exist, or it belongs to a different account."
        action={
          <Link to="/account/orders">
            <Badge tone="blue">Back to your orders</Badge>
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
      {justPlaced && (
        <Card className="border-mint bg-mint/10 p-4">
          <p className="font-semibold text-navy">Order placed!</p>
          <p className="text-sm text-navy/70">
            Each seller in this order fulfills their part independently — you'll see status updates here.
          </p>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-navy/60">{new Date(order.createdAt).toLocaleString()}</p>
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
          <Card key={sellerOrder.id} className="p-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <p className="font-display font-semibold text-navy">{sellerOrder.storeName}</p>
              <Badge tone={SELLER_ORDER_STATUS_TONE[sellerOrder.status]}>{formatStatusLabel(sellerOrder.status)}</Badge>
            </div>
            <div className="divide-y divide-line">
              {sellerOrder.items.map((item, i) => (
                <div key={`${sellerOrder.id}-${i}`} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-navy">{item.productName}</p>
                    <p className="text-sm text-navy/60">
                      {item.quantity} × ${item.unitPrice}
                      {item.refundedQuantity > 0 && (
                        <span className="text-coral"> · {item.refundedQuantity} refunded</span>
                      )}
                    </p>
                  </div>
                  <p className="font-semibold text-navy">${item.lineTotal}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-end gap-1 pt-3 text-sm">
              <span className="font-semibold text-navy">Subtotal: ${sellerOrder.subtotal}</span>
              {Number(sellerOrder.refundedAmount) > 0 && (
                <span className="text-coral">Refunded: −${sellerOrder.refundedAmount}</span>
              )}
            </div>
          </Card>
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
          <p className="font-display text-lg font-semibold text-navy">
            {hasRefunds ? 'Amount charged (after refunds)' : 'Order total'}
          </p>
          <p className="font-display text-xl font-semibold text-navy">${order.effectiveTotal}</p>
        </div>
      </Card>
    </div>
  );
}
