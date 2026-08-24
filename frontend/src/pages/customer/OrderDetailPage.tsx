import { Link, useLocation, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useMyOrder } from '../../features/orders/hooks';

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
        <Badge tone="neutral">{order.status.replace(/_/g, ' ')}</Badge>
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
              <Badge tone="neutral">{sellerOrder.status.replace(/_/g, ' ')}</Badge>
            </div>
            <div className="divide-y divide-line">
              {sellerOrder.items.map((item, i) => (
                <div key={`${sellerOrder.id}-${i}`} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-navy">{item.productName}</p>
                    <p className="text-sm text-navy/60">
                      {item.quantity} × ${item.unitPrice}
                    </p>
                  </div>
                  <p className="font-semibold text-navy">${item.lineTotal}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-3 text-sm font-semibold text-navy">
              Subtotal: ${sellerOrder.subtotal}
            </div>
          </Card>
        ))}
      </div>

      <Card className="flex items-center justify-between p-5">
        <p className="font-display text-lg font-semibold text-navy">Order total</p>
        <p className="font-display text-xl font-semibold text-navy">${order.totalAmount}</p>
      </Card>
    </div>
  );
}
