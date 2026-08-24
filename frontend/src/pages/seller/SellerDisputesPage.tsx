import { useState } from 'react';
import { getApiErrorMessage } from '../../api/error';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { useDisputeMutations, useSellerDisputes } from '../../features/disputes/hooks';
import { useDisputeRealtime } from '../../realtime/hooks/useDisputeRealtime';

export function SellerDisputesPage() {
  useDisputeRealtime();
  const query = useSellerDisputes();
  const { respond } = useDisputeMutations();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (query.isLoading) return <Spinner label="Loading disputes…" />;
  if (query.isError) return <EmptyState title="Disputes could not be loaded" description="Try refreshing this page." />;

  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="font-display text-2xl font-semibold text-navy">Dispute desk</h1><p className="text-sm text-navy/60">Only cases tied to your stall appear here.</p></div>
      {error && <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}
      {!query.data?.data.length ? <EmptyState title="No open paperwork" description="No customer disputes are attached to your seller orders." /> : query.data.data.map((dispute) => (
        <Card key={dispute.id} className="p-5">
          <div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-navy">Order #{dispute.sellerOrderId.slice(0, 8)} · {dispute.reason}</p><p className="text-xs text-navy/50">Opened {new Date(dispute.createdAt).toLocaleString()}</p></div><Badge tone="blue">{dispute.status.replaceAll('_', ' ')}</Badge></div>
          <p className="mt-3 text-sm text-navy/70">{dispute.description}</p>
          {dispute.sellerResponse ? <p className="mt-3 rounded-xl bg-cream p-3 text-sm"><strong>Your response:</strong> {dispute.sellerResponse}</p> : ['OPEN', 'UNDER_REVIEW'].includes(dispute.status) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-medium text-navy">Response<textarea className="min-h-20 rounded-xl border border-line p-3 text-sm" value={responses[dispute.id] ?? ''} onChange={(event) => setResponses((state) => ({ ...state, [dispute.id]: event.target.value }))} placeholder="Add a factual response for the admin" /></label>
              <Button disabled={(responses[dispute.id]?.trim().length ?? 0) < 3 || respond.isPending} onClick={() => { setError(null); respond.mutate({ id: dispute.id, response: responses[dispute.id] }, { onError: (cause) => setError(getApiErrorMessage(cause, 'Response could not be sent.')) }); }}>Send response</Button>
            </div>
          )}
          {dispute.adminResolution && <p className="mt-3 border-t border-line pt-3 text-sm text-navy"><strong>Admin resolution:</strong> {dispute.adminResolution}</p>}
        </Card>
      ))}
    </div>
  );
}
