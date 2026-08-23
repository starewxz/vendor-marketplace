import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  notch?: boolean;
}

/**
 * `notch` applies the brand's signature die-cut corner (see theme.css
 * `.cargo-tag`). Used on product cards and promo tiles, skipped on plain
 * content panels (forms, tables) so the motif stays a marketplace accent
 * rather than a blanket style.
 */
export function Card({ notch = false, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white border border-line rounded-2xl ${notch ? 'cargo-tag' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
