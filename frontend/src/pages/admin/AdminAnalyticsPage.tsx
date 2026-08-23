import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function AdminAnalyticsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Analytics</h1>
      <NotYetAvailable feature="Platform analytics" />
    </div>
  );
}
