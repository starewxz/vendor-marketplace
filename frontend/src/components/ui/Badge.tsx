import type { ReactNode } from 'react';

type BadgeTone = 'yellow' | 'blue' | 'coral' | 'mint' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  yellow: 'bg-cargo-yellow text-navy',
  blue: 'bg-crew-blue text-paper',
  coral: 'bg-coral text-paper',
  mint: 'bg-mint text-paper',
  neutral: 'bg-navy/5 text-navy border border-line',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
