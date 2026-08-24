import { useRealtime } from '../../realtime/useRealtime';

export function ConnectionPill() {
  const { status } = useRealtime();
  const label = status === 'live' ? 'Live' : status === 'connecting' || status === 'reconnecting' ? 'Reconnecting…' : 'Offline';
  const color = status === 'live' ? 'bg-mint' : status === 'offline' ? 'bg-coral' : 'bg-cargo-yellow-dark';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy/55" title={status === 'offline' ? 'Live updates are delayed; normal browsing still works.' : 'Realtime connection status'}>
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}
