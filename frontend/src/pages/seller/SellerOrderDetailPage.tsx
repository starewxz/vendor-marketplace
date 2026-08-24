import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useCancelMySellerOrder,
  useMySellerOrder,
  useUpdateMySellerOrderStatus,
} from '../../features/sellerOrders/hooks';
import { formatStatusLabel, isCancellable, nextStatusAction, SELLER_ORDER_STATUS_TONE } from '../../features/sellerOrders/status';
import { getApiErrorMessage } from '../../api/error';
import { useOrderRealtime } from '../../realtime/hooks/useOrderRealtime';

export function SellerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sellerOrder, isLoading, isError } = useMySellerOrder(id);
  const updateStatus = useUpdateMySellerOrderStatus(id ?? '');
  const cancelOrder = useCancelMySellerOrder(id ?? '');
  const [actionError, setActionError] = useState<string | null>(null);
  useOrderRealtime({ sellerOrderId: id });

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

  const next = nextStatusAction(sellerOrder.status);
  const canCancel = isCancellable(sellerOrder.status);
  const isMutating = updateStatus.isPending || cancelOrder.isPending;
  const hasRefunds = sellerOrder.refunds.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Order #{sellerOrder.id.slice(0, 8)}</h1>
          <p className="text-sm text-navy/60">{new Date(sellerOrder.createdAt).toLocaleString()}</p>
        </div>
        <Badge tone={SELLER_ORDER_STATUS_TONE[sellerOrder.status]}>{formatStatusLabel(sellerOrder.status)}</Badge>
      </div>

      {(next || canCancel) && (
        <Card className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {next && (
              <Button
                size="sm"
                disabled={isMutating}
                onClick={() => {
                  setActionError(null);
                  updateStatus.mutate(next.status, { onError: (err) => setActionError(getApiErrorMessage(err)) });
                }}
              >
                {updateStatus.isPending ? 'Updating…' : next.label}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="danger"
                disabled={isMutating}
                onClick={() => {
                  if (!confirm('Cancel this seller order? Stock will be restored and the commission/earnings reversed.')) return;
                  setActionError(null);
                  cancelOrder.mutate(undefined, { onError: (err) => setActionError(getApiErrorMessage(err)) });
                }}
              >
                {cancelOrder.isPending ? 'Cancelling…' : 'Cancel order'}
              </Button>
            )}
          </div>
          {actionError && <p className="text-sm text-coral">{actionError}</p>}
        </Card>
      )}

      {address && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-navy">Ship to</p>
          <p className="text-sm text-navy/70">{address}</p>
        </Card>
      )}

      <Card className="p-5">
        <p className="font-display font-semibold text-navy">Items</p>
        <div className="divide-y divide-line">
          {sellerOrder.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3">
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
        {hasRefunds && (
          <>
            <div className="flex justify-between text-sm text-coral">
              <span>Refunded</span>
              <span>−${sellerOrder.financials.refundedAmount}</span>
            </div>
            <div className="flex justify-between text-sm text-mint">
              <span>Commission returned on refunds</span>
              <span>+${sellerOrder.financials.commissionReversed}</span>
            </div>
          </>
        )}
        <div className="flex justify-between border-t border-line pt-2 font-display text-lg font-semibold text-navy">
          <span>Your net earnings</span>
          <span>${sellerOrder.financials.effectiveSellerNet}</span>
        </div>
      </Card>

      {hasRefunds && (
        <Card className="p-5">
          <p className="font-display font-semibold text-navy">Refund history</p>
          <div className="divide-y divide-line">
            {sellerOrder.refunds.map((refund) => (
              <div key={refund.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-navy">{refund.quantity} unit(s) refunded</p>
                  {refund.reason && <p className="text-xs text-navy/50">{refund.reason}</p>}
                  <p className="text-xs text-navy/40">{new Date(refund.createdAt).toLocaleDateString()}</p>
                </div>
                <p className="font-semibold text-coral">−${refund.amount}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
