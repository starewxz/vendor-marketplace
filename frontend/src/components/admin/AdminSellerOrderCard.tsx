import { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCancelAdminSellerOrder } from '../../features/adminOrders/hooks';
import { useCreateRefund } from '../../features/refunds/hooks';
import { formatStatusLabel, isCancellable, SELLER_ORDER_STATUS_TONE } from '../../features/sellerOrders/status';
import { getApiErrorMessage } from '../../api/error';
import type { AdminSellerOrderView } from '../../types/order';

interface AdminSellerOrderCardProps {
  sellerOrder: AdminSellerOrderView;
  parentOrderId: string;
}

export function AdminSellerOrderCard({ sellerOrder, parentOrderId }: AdminSellerOrderCardProps) {
  const cancelOrder = useCancelAdminSellerOrder(sellerOrder.id, parentOrderId);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const canCancel = isCancellable(sellerOrder.status);
  const hasRefunds = sellerOrder.refunds.length > 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <p className="font-display font-semibold text-navy">{sellerOrder.storeName}</p>
          <p className="text-xs text-navy/50">Seller order #{sellerOrder.id.slice(0, 8)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={SELLER_ORDER_STATUS_TONE[sellerOrder.status]}>{formatStatusLabel(sellerOrder.status)}</Badge>
          {canCancel && (
            <Button
              size="sm"
              variant="danger"
              disabled={cancelOrder.isPending}
              onClick={() => {
                if (!confirm('Cancel this seller order? Stock will be restored and the commission/earnings reversed.')) return;
                setCancelError(null);
                cancelOrder.mutate(undefined, { onError: (err) => setCancelError(getApiErrorMessage(err)) });
              }}
            >
              {cancelOrder.isPending ? 'Cancelling…' : 'Cancel'}
            </Button>
          )}
        </div>
      </div>
      {cancelError && <p className="pt-2 text-sm text-coral">{cancelError}</p>}

      <div className="divide-y divide-line">
        {sellerOrder.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-navy">{item.productName}</p>
              <p className="text-sm text-navy/60">
                {item.quantity} × ${item.unitPrice}
                {item.refundedQuantity > 0 && <span className="text-coral"> · {item.refundedQuantity} refunded</span>}
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
        {hasRefunds && (
          <>
            <div className="flex justify-between text-coral">
              <span>Refunded</span>
              <span>−${sellerOrder.financials.refundedAmount}</span>
            </div>
            <div className="flex justify-between text-coral">
              <span>Commission reversed</span>
              <span>+${sellerOrder.financials.commissionReversed}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold text-navy">
          <span>Effective seller net</span>
          <span>${sellerOrder.financials.effectiveSellerNet}</span>
        </div>
      </div>

      {hasRefunds && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-sm font-semibold text-navy">Refund history</p>
          {sellerOrder.refunds.map((refund) => (
            <div key={refund.id} className="flex items-center justify-between text-sm">
              <span className="text-navy/70">
                {refund.quantity} unit(s){refund.reason ? ` — ${refund.reason}` : ''}
              </span>
              <span className="font-medium text-coral">−${refund.amount}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-line pt-3">
        {!refundOpen ? (
          <Button size="sm" variant="ghost" onClick={() => setRefundOpen(true)}>
            Create partial refund
          </Button>
        ) : (
          <RefundForm sellerOrder={sellerOrder} parentOrderId={parentOrderId} onClose={() => setRefundOpen(false)} />
        )}
      </div>
    </Card>
  );
}

function RefundForm({
  sellerOrder,
  parentOrderId,
  onClose,
}: {
  sellerOrder: AdminSellerOrderView;
  parentOrderId: string;
  onClose: () => void;
}) {
  const refundableItems = sellerOrder.items.filter((item) => item.quantity - item.refundedQuantity > 0);
  const [itemId, setItemId] = useState(refundableItems[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ amount: string; commissionAdjustment: string; sellerAdjustment: string } | null>(null);
  const createRefund = useCreateRefund(sellerOrder.id, parentOrderId);

  const selectedItem = refundableItems.find((item) => item.id === itemId);
  const maxQuantity = selectedItem ? selectedItem.quantity - selectedItem.refundedQuantity : 0;

  if (refundableItems.length === 0) {
    return <p className="text-sm text-navy/50">Every item on this seller order has already been fully refunded.</p>;
  }

  function handleSubmit() {
    if (!selectedItem) return;
    setError(null);
    setResult(null);
    createRefund.mutate(
      {
        idempotencyKey: crypto.randomUUID(),
        input: { sellerOrderItemId: selectedItem.id, quantity, reason: reason || undefined },
      },
      {
        onSuccess: (refund) => {
          setResult({ amount: refund.amount, commissionAdjustment: refund.commissionAdjustment, sellerAdjustment: refund.sellerAdjustment });
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-cream/40 p-4">
      <div className="flex flex-col gap-1.5 text-sm font-medium text-navy">
        Item
        <select
          className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy focus-visible:border-crew-blue"
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setQuantity(1);
            setResult(null);
          }}
        >
          {refundableItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.productName} ({item.quantity - item.refundedQuantity} refundable)
            </option>
          ))}
        </select>
      </div>
      <Input
        label={`Quantity (max ${maxQuantity})`}
        type="number"
        min={1}
        max={maxQuantity}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />

      {error && <p className="text-sm text-coral">{error}</p>}
      {result && (
        <div className="rounded-xl border border-mint bg-mint/10 p-3 text-sm text-navy">
          <p className="font-semibold">Refund created</p>
          <p>
            ${result.amount} refunded — commission reversed ${result.commissionAdjustment}, seller net reversed $
            {result.sellerAdjustment}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={createRefund.isPending || quantity < 1 || quantity > maxQuantity}
          onClick={handleSubmit}
        >
          {createRefund.isPending ? 'Refunding…' : 'Confirm refund'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {result ? 'Done' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
