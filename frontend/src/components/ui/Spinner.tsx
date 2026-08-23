export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-navy/60" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy/20 border-t-crew-blue" />
      {label}
    </div>
  );
}
