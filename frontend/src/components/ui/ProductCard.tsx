import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CatalogProduct } from '../../types/product';
import { Card } from './Card';
import { Badge } from './Badge';
import { ProductImage } from './ProductImage';
import { useAuth } from '../../features/auth/useAuth';
import { useAddCartItem } from '../../features/cart/hooks';

const LOW_STOCK_THRESHOLD = 5;

export function ProductCard({ product }: { product: CatalogProduct }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const addToCart = useAddCartItem();
  const [justAdded, setJustAdded] = useState(false);

  const lowStock = product.available && product.stockQuantity > 0 && product.stockQuantity <= LOW_STOCK_THRESHOLD;
  const canQuickAdd = product.productType === 'FIXED_PRICE' && product.available && (!user || user.role === 'CUSTOMER');

  function handleQuickAdd(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/product/${product.id}` } } });
      return;
    }
    addToCart.mutate(
      { productId: product.id, quantity: 1 },
      { onSuccess: () => { setJustAdded(true); setTimeout(() => setJustAdded(false), 1600); } },
    );
  }

  return (
    <Link to={`/product/${product.id}`} className="group block">
      <Card
        className="flex h-full flex-col overflow-hidden border border-line transition-shadow duration-150 hover:shadow-md"
      >
        <div className="relative aspect-square overflow-hidden bg-cream/60">
          <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.06]">
            <ProductImage product={product} variant="thumbnail" />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
            <div className="flex flex-col items-start gap-1">
              {product.productType === 'AUCTION' && <Badge tone="coral">Auction</Badge>}
              {!product.available && <Badge tone="neutral">Sold out</Badge>}
              {product.available && lowStock && <Badge tone="yellow">Only {product.stockQuantity} left</Badge>}
            </div>
          </div>

          {canQuickAdd && (
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={addToCart.isPending}
              aria-label={`Add ${product.name} to cart`}
              className={`absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy text-navy shadow-md transition-all sm:opacity-0 sm:group-hover:opacity-100 ${
                justAdded ? 'bg-mint text-paper' : 'bg-cargo-yellow hover:bg-cargo-yellow-dark'
              }`}
            >
              {justAdded ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-navy">{product.name}</h3>
          <span className="text-xs text-navy/50">{product.sellerName}</span>
          <span className="text-xs text-navy/55">
            {product.ratingCount ? (
              <span className="inline-flex items-center gap-0.5">
                <span className="text-cargo-yellow-dark">★</span> {product.rating.toFixed(1)}
                <span className="text-navy/40"> · {product.ratingCount}</span>
              </span>
            ) : (
              'Not rated yet'
            )}
          </span>
          <div className="mt-auto flex items-baseline justify-between pt-1.5">
            <span className="font-mono text-lg font-extrabold text-navy">
              {product.price !== null ? `$${product.price.toFixed(2)}` : '—'}
            </span>
            {product.productType === 'AUCTION' && (
              <span className="text-[11px] font-bold text-coral">current bid</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
