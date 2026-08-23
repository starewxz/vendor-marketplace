import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useAdminApplications,
  useApproveApplication,
  useRejectApplication,
} from '../../features/sellerApplications/hooks';
import { getApiErrorMessage } from '../../api/error';
import type { SellerApplication } from '../../types/sellerApplication';

function RejectDialog({ application, onClose }: { application: SellerApplication; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rejectMutation = useRejectApplication();

  function handleReject() {
    setError(null);
    rejectMutation.mutate(
      { id: application.id, reason },
      {
        onSuccess: onClose,
        onError: (err) => setError(getApiErrorMessage(err, 'Could not reject this application.')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <Card className="flex w-full max-w-sm flex-col gap-3 p-5">
        <h3 className="font-display text-lg font-semibold text-navy">Reject "{application.requestedStoreName}"</h3>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-navy" htmlFor="reject-reason">
          Reason (shown to the applicant)
          <textarea
            id="reject-reason"
            className="min-h-24 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy focus-visible:border-crew-blue"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            required
          />
        </label>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReject} disabled={rejectMutation.isPending || reason.length < 5}>
            {rejectMutation.isPending ? 'Rejecting…' : 'Reject application'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ApplicationRow({ application }: { application: SellerApplication }) {
  const [rejecting, setRejecting] = useState(false);
  const approveMutation = useApproveApplication();
  const [approveError, setApproveError] = useState<string | null>(null);

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-navy">{application.requestedStoreName}</p>
        <p className="text-sm text-navy/60">{application.businessDescription}</p>
        <p className="mt-1 text-xs text-navy/40">
          Submitted {new Date(application.createdAt).toLocaleString()}
        </p>
        {approveError && <p className="mt-1 text-sm text-coral">{approveError}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          onClick={() =>
            approveMutation.mutate(application.id, {
              onError: (err) => setApproveError(getApiErrorMessage(err, 'Could not approve this application.')),
            })
          }
          disabled={approveMutation.isPending}
        >
          Approve
        </Button>
        <Button size="sm" variant="danger" onClick={() => setRejecting(true)}>
          Reject
        </Button>
      </div>
      {rejecting && <RejectDialog application={application} onClose={() => setRejecting(false)} />}
    </Card>
  );
}

export function AdminSellersPage() {
  const { data: applications, isLoading, isError } = useAdminApplications('PENDING');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy">Seller applications</h1>
        <p className="text-sm text-navy/60">Pending applications waiting for review.</p>
      </div>

      {isLoading && <Spinner label="Loading applications…" />}

      {isError && (
        <EmptyState title="Couldn't load applications" description="Check that the backend API is reachable." />
      )}

      {!isLoading && !isError && (!applications || applications.length === 0) && (
        <EmptyState title="No pending applications" description="New seller applications will show up here." />
      )}

      {applications?.map((application) => (
        <ApplicationRow key={application.id} application={application} />
      ))}
    </div>
  );
}
