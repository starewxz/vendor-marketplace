import { Badge } from './Badge';
import { EmptyState } from './EmptyState';

/**
 * Used on page shells whose backend functionality doesn't exist yet
 * (Stage 1 is foundation-only). Keeps that explicit in the UI instead of
 * quietly rendering mock data that looks real.
 */
export function NotYetAvailable({ feature }: { feature: string }) {
  return (
    <EmptyState
      title={`${feature} is still being built`}
      description="This part of the crew is still unpacking boxes. The page shell, layout, and routing are ready — the backend logic lands in a later stage."
      action={<Badge tone="blue">Coming in a later stage</Badge>}
    />
  );
}
