import { useState } from 'react';
import { getApiErrorMessage } from '../../api/error';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { useAdminDisputes, useDisputeMutations } from '../../features/disputes/hooks';
import { useDisputeRealtime } from '../../realtime/hooks/useDisputeRealtime';
import type { Dispute, DisputeStatus } from '../../types/dispute';
import { isValidRefundQuantity } from '../../features/stage9/ux';

const ACTIVE_STATUSES: DisputeStatus[] = ['OPEN', 'UNDER_REVIEW'];

function DisputeCase({ dispute }: { dispute: Dispute }) {
  const actions = useDisputeMutations();
  const refundableItems = dispute.sellerOrder?.items.filter((item) => item.quantity > item.refundedQuantity) ?? [];
  const [note, setNote] = useState('');
  const [includeRefund, setIncludeRefund] = useState(false);
  const [itemId, setItemId] = useState(refundableItems[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const selectedItem = refundableItems.find((item) => item.id === itemId);
  const maxQuantity = selectedItem ? selectedItem.quantity - selectedItem.refundedQuantity : 0;
  const active = ACTIVE_STATUSES.includes(dispute.status);

  function resolve(outcome: 'CUSTOMER' | 'SELLER') {
    setError(null);
    actions.resolve.mutate({
      id: dispute.id,
      idempotencyKey: crypto.randomUUID(),
      outcome,
      adminResolution: note,
      refund: outcome === 'CUSTOMER' && includeRefund && selectedItem ? {
        sellerOrderItemId: selectedItem.id,
        quantity,
        reason: `Dispute ${dispute.id}`,
      } : undefined,
    }, { onError: (cause) => setError(getApiErrorMessage(cause, 'Dispute could not be resolved.')) });
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-2 bg-cargo-yellow" />
      <div className="p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-navy">{dispute.sellerProfile?.storeName ?? 'Seller'} · {dispute.reason}</p><p className="text-xs text-navy/50">Case #{dispute.id.slice(0, 8)} · seller order #{dispute.sellerOrderId.slice(0, 8)} · opened {new Date(dispute.createdAt).toLocaleString()}</p></div><Badge tone="blue">{dispute.status.replaceAll('_', ' ')}</Badge></div>
        <p className="mt-3 text-sm text-navy/70">{dispute.description}</p>
        {dispute.sellerResponse && <p className="mt-3 rounded-xl bg-cream p-3 text-sm"><strong>Seller response:</strong> {dispute.sellerResponse}</p>}
        {active && (
          <div className="mt-4 grid gap-3 border-t border-line pt-4">
            <label className="grid gap-1 text-sm font-medium text-navy">Resolution note<textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-20 rounded-xl border border-line p-3 text-sm" placeholder="Record the decision and evidence considered" /></label>
            <label className="flex items-center gap-2 text-sm text-navy"><input type="checkbox" checked={includeRefund} disabled={!refundableItems.length} onChange={(event) => setIncludeRefund(event.target.checked)} />Include a partial refund calculated from the immutable order price</label>
            {includeRefund && refundableItems.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
                <label className="grid gap-1 text-sm font-medium text-navy">Order item<select value={itemId} onChange={(event) => { setItemId(event.target.value); setQuantity(1); }} className="rounded-xl border border-line bg-white px-3 py-2">{refundableItems.map((item) => <option key={item.id} value={item.id}>{item.productName} · {item.quantity - item.refundedQuantity} refundable</option>)}</select></label>
                <label className="grid gap-1 text-sm font-medium text-navy">Quantity<input type="number" min={1} max={maxQuantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="rounded-xl border border-line px-3 py-2" /></label>
              </div>
            )}
            {error && <p className="text-sm text-coral">{error}</p>}
            <div className="flex flex-wrap gap-2"><Button disabled={note.trim().length < 3 || actions.resolve.isPending || (includeRefund && (!selectedItem || !isValidRefundQuantity(quantity, selectedItem.quantity, selectedItem.refundedQuantity)))} onClick={() => resolve('CUSTOMER')}>Resolve for customer</Button><Button variant="secondary" disabled={note.trim().length < 3 || actions.resolve.isPending} onClick={() => resolve('SELLER')}>Resolve for seller</Button>{dispute.status === 'OPEN' && <Button variant="ghost" disabled={actions.status.isPending} onClick={() => actions.status.mutate({ id: dispute.id, status: 'UNDER_REVIEW' }, { onError: (cause) => setError(getApiErrorMessage(cause, 'Status could not be updated.')) })}>Mark under review</Button>}</div>
          </div>
        )}
        {dispute.adminResolution && <p className="mt-3 border-t border-line pt-3 text-sm"><strong>Resolution:</strong> {dispute.adminResolution}</p>}
      </div>
    </Card>
  );
}

export function AdminDisputesPage() {
  const [filter, setFilter] = useState<DisputeStatus | ''>('');
  const query = useAdminDisputes(filter || undefined);
  useDisputeRealtime();
  if (query.isLoading) return <Spinner label="Loading case files…" />;
  if (query.isError) return <EmptyState title="Case files could not be loaded" description="Try refreshing or changing the status filter." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-semibold text-navy">Dispute control</h1><p className="text-sm text-navy/60">Resolve the case; accounting follows the same audited refund rail.</p></div><label className="grid gap-1 text-xs font-medium text-navy/60">Status<select value={filter} onChange={(event) => setFilter(event.target.value as DisputeStatus | '')} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy"><option value="">All statuses</option>{['OPEN', 'UNDER_REVIEW', 'RESOLVED_CUSTOMER', 'RESOLVED_SELLER', 'CLOSED'].map((status) => <option key={status}>{status}</option>)}</select></label></div>
      {!query.data?.data.length ? <EmptyState title="Case queue clear" description="No disputes match this filter." /> : query.data.data.map((dispute) => <DisputeCase key={dispute.id} dispute={dispute} />)}
    </div>
  );
}
