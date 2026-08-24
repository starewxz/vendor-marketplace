import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAdminOrder } from '../../features/adminOrders/hooks';

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-navy/60">
            Buyer {order.buyerId} · {new Date(order.createdAt).toLocaleString()}
          </p>
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
              <div>
                <p className="font-display font-semibold text-navy">{sellerOrder.storeName}</p>
                <p className="text-xs text-navy/50">Seller order #{sellerOrder.id.slice(0, 8)}</p>
              </div>
              <Badge tone="neutral">{sellerOrder.status.replace(/_/g, ' ')}</Badge>
            </div>
            <div className="divide-y divide-line">
              {sellerOrder.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3">
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
            <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between text-navy/70">
                <span>Subtotal</span>
                <span>${sellerOrder.subtotal}</span>
              </div>
              <div className="flex justify-between text-navy/70">
                <span>Platform commission</span>
                <span>${sellerOrder.commissionAmount}</span>
              </div>
              <div className="flex justify-between font-semibold text-navy">
                <span>Seller net</span>
                <span>${sellerOrder.sellerNetAmount}</span>
              </div>
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
