import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-cream/40 px-6 py-14 text-center">
      <h3 className="font-display text-lg font-semibold text-navy">{title}</h3>
      {description && <p className="max-w-sm text-sm text-navy/60">{description}</p>}
      {action}
    </div>
  );
}
