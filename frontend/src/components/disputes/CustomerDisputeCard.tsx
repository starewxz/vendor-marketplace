import { useState } from 'react';
import { getApiErrorMessage } from '../../api/error';
import { useDisputeMutations } from '../../features/disputes/hooks';
import type { Dispute } from '../../types/dispute';
import type { CustomerSellerOrderView } from '../../types/order';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { canOpenDispute } from '../../features/stage8/presentation';

export function CustomerDisputeCard({ sellerOrder, dispute }: { sellerOrder: CustomerSellerOrderView; dispute?: Dispute }) {
  const { create } = useDisputeMutations(); const [open, setOpen] = useState(false); const [reason, setReason] = useState('Item issue'); const [description, setDescription] = useState(''); const [error, setError] = useState<string | null>(null);
  if (dispute) return <div className="mt-4 rounded-xl border border-cargo-yellow bg-cargo-yellow/10 p-3 text-sm"><div className="flex justify-between"><strong className="text-navy">Dispute: {dispute.reason}</strong><Badge tone="blue">{dispute.status.replaceAll('_', ' ')}</Badge></div><p className="mt-1 text-navy/70">{dispute.description}</p>{dispute.adminResolution && <p className="mt-2 border-t border-line pt-2 text-navy"><strong>Resolution:</strong> {dispute.adminResolution}</p>}</div>;
  if (!canOpenDispute(sellerOrder.status)) return null;
  if (!open) return <Button className="mt-4" size="sm" variant="ghost" onClick={() => setOpen(true)}>Open a dispute</Button>;
  return <div className="mt-4 grid gap-2 rounded-xl border border-line bg-cream/30 p-3"><input value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} className="rounded-xl border border-line px-3 py-2 text-sm" aria-label="Dispute reason" /><textarea value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} className="min-h-24 rounded-xl border border-line p-3 text-sm" placeholder="Describe what happened (at least 10 characters)" /><div className="flex gap-2"><Button size="sm" disabled={description.trim().length < 10 || create.isPending} onClick={() => { setError(null); create.mutate({ sellerOrderId: sellerOrder.id, reason, description }, { onSuccess: () => setOpen(false), onError: (e) => setError(getApiErrorMessage(e)) }); }}>Submit dispute</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>{error && <p className="text-sm text-coral">{error}</p>}</div>;
}
