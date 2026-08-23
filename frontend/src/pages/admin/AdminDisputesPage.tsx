import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function AdminDisputesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Disputes</h1>
      <NotYetAvailable feature="Dispute resolution" />
    </div>
  );
}
