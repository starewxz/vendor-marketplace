import { Link } from 'react-router-dom';
import type { CatalogProduct } from '../../types/product';
import { Card } from './Card';
import { Badge } from './Badge';

export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link to={`/product/${product.id}`}>
      <Card notch className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
        <div className="flex aspect-square items-center justify-center bg-cream/60 text-navy/20">
          {product.imageUrls[0] ? (
            <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 7l9-4 9 4-9 4-9-4Z" strokeLinejoin="round" />
              <path d="M3 7v10l9 4 9-4V7" strokeLinejoin="round" />
              <path d="M12 11v10" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <div className="flex items-center gap-1.5">
            {product.productType === 'AUCTION' && <Badge tone="coral">Auction</Badge>}
            {!product.available && <Badge tone="neutral">Sold out</Badge>}
          </div>
          <h3 className="line-clamp-2 text-sm font-medium text-navy">{product.name}</h3>
          <span className="text-xs text-navy/50">{product.sellerName}</span>
          <span className="mt-auto font-mono text-base font-semibold text-navy">
            {product.price !== null ? `$${product.price.toFixed(2)}` : '—'}
          </span>
        </div>
      </Card>
    </Link>
  );
}
