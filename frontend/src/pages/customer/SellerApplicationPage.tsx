import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../features/auth/useAuth';
import { useApplyForSeller, useMyApplications } from '../../features/sellerApplications/hooks';
import { getApiErrorMessage } from '../../api/error';

function ApplicationForm() {
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const applyMutation = useApplyForSeller();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    applyMutation.mutate(
      { businessName, description },
      { onError: (err) => setError(getApiErrorMessage(err, 'Could not submit your application.')) },
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-navy">Apply to become a seller</h2>
        <p className="text-sm text-navy/60">Tell us a bit about what you'll sell — an admin will review it.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="businessName"
          label="Store name"
          placeholder="Jane's Vintage Finds"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          minLength={2}
          required
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-navy" htmlFor="description">
          What will you sell?
          <textarea
            id="description"
            className="min-h-28 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy placeholder:text-navy/40 focus-visible:border-crew-blue"
            placeholder="A short description of your business and what you plan to list…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minLength={20}
            required
          />
        </label>
        {error && <p className="text-sm text-coral">{error}</p>}
        <Button type="submit" disabled={applyMutation.isPending} className="w-fit">
          {applyMutation.isPending ? 'Submitting…' : 'Submit application'}
        </Button>
      </form>
    </Card>
  );
}

export function SellerApplicationPage() {
  const { user, refreshSession } = useAuth();
  const { data: applications, isLoading, isError } = useMyApplications();
  const latest = applications?.[0];
  const activated = useRef(false);

  useEffect(() => {
    if (latest?.status !== 'APPROVED' || user?.role !== 'CUSTOMER' || activated.current) return;
    activated.current = true;
    void refreshSession().catch(() => {
      activated.current = false;
    });
  }, [latest?.status, refreshSession, user?.role]);

  if (user?.role === 'SELLER' || user?.role === 'ADMIN') {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <Badge tone="mint">Approved</Badge>
        <h2 className="font-display text-lg font-semibold text-navy">You're already a seller</h2>
        <Link to="/seller">
          <Button>Go to your seller dashboard</Button>
        </Link>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner label="Checking your application status…" />
      </div>
    );
  }

  if (isError) {
    return <EmptyState title="Couldn't load your application status" description="Try refreshing the page." />;
  }

  if (!latest) {
    return <ApplicationForm />;
  }

  if (latest.status === 'PENDING') {
    return (
      <Card className="flex flex-col gap-3 p-6">
        <Badge tone="blue">Pending review</Badge>
        <h2 className="font-display text-lg font-semibold text-navy">"{latest.requestedStoreName}" is under review</h2>
        <p className="text-sm text-navy/60">
          An admin will approve or reject this application. Submitted{' '}
          {new Date(latest.createdAt).toLocaleDateString()}.
        </p>
      </Card>
    );
  }

  if (latest.status === 'REJECTED') {
    return (
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2 p-6">
          <Badge tone="coral">Rejected</Badge>
          <h2 className="font-display text-lg font-semibold text-navy">
            "{latest.requestedStoreName}" wasn't approved
          </h2>
          {latest.rejectionReason && <p className="text-sm text-navy/70">Admin note: {latest.rejectionReason}</p>}
        </Card>
        <ApplicationForm />
      </div>
    );
  }

  // status === 'APPROVED' but the session's role hasn't caught up yet.
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      <Badge tone="mint">Approved</Badge>
      <h2 className="font-display text-lg font-semibold text-navy">You've been approved!</h2>
      <p className="max-w-xs text-sm text-navy/60">Activate seller access on this device to continue.</p>
      <Button onClick={() => void refreshSession()}>Activate seller access</Button>
    </Card>
  );
}
