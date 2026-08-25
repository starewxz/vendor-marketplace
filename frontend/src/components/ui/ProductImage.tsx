import { useMemo, useState } from 'react';
import { resolveDemoImageUrl, withImageParams } from '../../lib/productImages';

interface ProductImageSubject {
  id: string;
  name: string;
  categoryName?: string | null;
  imageUrls?: string[];
}

interface ProductImageProps {
  product: ProductImageSubject;
  className?: string;
  /** Larger/eager for the product detail hero; default suits grid thumbnails. */
  variant?: 'thumbnail' | 'hero';
}

const SIZE_PARAMS: Record<NonNullable<ProductImageProps['variant']>, string> = {
  thumbnail: 'w=480&q=65&auto=format&fit=crop',
  hero: 'w=1000&q=75&auto=format&fit=crop',
};

/**
 * Single source of truth for rendering a product image anywhere in the app.
 * Priority: seller/admin-uploaded image → stable demo image resolved from
 * product name/category (see lib/productImages) → branded fallback. A
 * failed/broken uploaded URL (onError) falls through to the same demo/
 * fallback chain rather than showing a broken-image icon.
 */
export function ProductImage({ product, className = '', variant = 'thumbnail' }: ProductImageProps) {
  const uploaded = product.imageUrls?.[0];
  const [uploadedFailed, setUploadedFailed] = useState(false);

  const demoUrl = useMemo(() => {
    if (uploaded && !uploadedFailed) return null;
    return resolveDemoImageUrl(product);
  }, [uploaded, uploadedFailed, product]);

  const src = uploaded && !uploadedFailed
    ? uploaded
    : demoUrl
      ? withImageParams(demoUrl, SIZE_PARAMS[variant])
      : null;

  if (!src) {
    return <ProductImageFallback name={product.name} className={className} />;
  }

  return (
    <img
      src={src}
      alt={product.name}
      loading={variant === 'hero' ? 'eager' : 'lazy'}
      className={`h-full w-full object-cover ${className}`}
      onError={() => {
        if (uploaded && !uploadedFailed) setUploadedFailed(true);
      }}
    />
  );
}

function ProductImageFallback({ name, className = '' }: { name: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={name}
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-cream to-cargo-yellow/25 ${className}`}
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" className="text-navy/25" aria-hidden="true">
        <circle cx="7" cy="7" r="2.6" fill="currentColor" opacity="0.7" />
        <circle cx="17" cy="7" r="2.6" fill="currentColor" opacity="0.7" />
        <path d="M3 7h1.6M19.4 7H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="3" y="12" width="18" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 16h18" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}
