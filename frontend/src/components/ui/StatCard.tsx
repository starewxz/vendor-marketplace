import { Card } from './Card';

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <span className="text-xs font-medium tracking-wide text-navy/50 uppercase">{label}</span>
      <div className="mt-1 font-mono text-2xl font-semibold text-navy">{value}</div>
    </Card>
  );
}
