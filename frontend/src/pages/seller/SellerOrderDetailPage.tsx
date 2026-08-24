import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useMySellerOrder } from '../../features/sellerOrders/hooks';

export function SellerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sellerOrder, isLoading, isError } = useMySellerOrder(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner label="Loading order…" />
      </div>
    );
  }

  if (isError || !sellerOrder) {
    return (
      <EmptyState
        title="We couldn't find that order"
        description="It may not exist, or it belongs to a different seller."
        action={
          <Link to="/seller/orders">
            <Badge tone="blue">Back to your orders</Badge>
          </Link>
        }
      />
    );
  }

  const address = [
    sellerOrder.shippingAddressLine1,
    sellerOrder.shippingAddressLine2,
    sellerOrder.shippingCity,
    sellerOrder.shippingPostalCode,
    sellerOrder.shippingCountry,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Order #{sellerOrder.id.slice(0, 8)}</h1>
          <p className="text-sm text-navy/60">{new Date(sellerOrder.createdAt).toLocaleString()}</p>
        </div>
        <Badge tone="neutral">{sellerOrder.status.replace(/_/g, ' ')}</Badge>
      </div>

      {address && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-navy">Ship to</p>
          <p className="text-sm text-navy/70">{address}</p>
        </Card>
      )}

      <Card className="p-5">
        <p className="font-display font-semibold text-navy">Items</p>
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
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <div className="flex justify-between text-sm text-navy/70">
          <span>Subtotal</span>
          <span>${sellerOrder.subtotal}</span>
        </div>
        <div className="flex justify-between text-sm text-coral">
          <span>Platform commission</span>
          <span>−${sellerOrder.commissionAmount}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 font-display text-lg font-semibold text-navy">
          <span>Your net earnings</span>
          <span>${sellerOrder.sellerNetAmount}</span>
        </div>
      </Card>
    </div>
  );
}
