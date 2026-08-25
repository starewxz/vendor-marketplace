import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useProduct } from '../../features/catalog/useProduct';
import { useAddCartItem } from '../../features/cart/hooks';
import { useAuth } from '../../features/auth/useAuth';
import { getApiErrorMessage } from '../../api/error';
import { AuctionPanel } from '../../components/auction/AuctionPanel';
import { useProductRealtime } from '../../realtime/hooks/useProductRealtime';
import { ReviewPanel } from '../../components/reviews/ReviewPanel';
import { clampPurchaseQuantity } from '../../features/stage9/ux';
import { ProductImage } from '../../components/ui/ProductImage';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError } = useProduct(id);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const addToCart = useAddCartItem();
  const [addToCartError, setAddToCartError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  useProductRealtime(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner label="Loading product…" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <EmptyState
        title="We couldn't find that crate"
        description="It may have been unpublished, or the link is off. Try browsing the catalog instead."
      />
    );
  }

  const isAuction = product.type === 'AUCTION';
  const isAvailable = product.stockQuantity > 0;

  return (
    <div className="flex flex-col gap-6 pb-20 sm:pb-0">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-navy/50">
        <Link to="/catalog" className="hover:text-crew-blue hover:underline">Catalog</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/catalog?categoryId=${product.category.id}`} className="hover:text-crew-blue hover:underline">
          {product.category.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="line-clamp-1 text-navy/70">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-cream/60">
          <ProductImage
            product={{
              id: product.id,
              name: product.name,
              categoryName: product.category.name,
              imageUrls: product.imageUrls,
            }}
            variant="hero"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            {isAuction && <Badge tone="coral">Auction</Badge>}
            <Badge tone={isAvailable ? 'mint' : 'neutral'}>{isAvailable ? 'In stock' : 'Sold out'}</Badge>
          </div>

          <div>
            <h1 className="font-display text-2xl font-extrabold text-navy sm:text-3xl">{product.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link to={`/catalog?sellerId=${product.sellerProfile.id}`} className="text-sm font-semibold text-crew-blue hover:underline">
                {product.sellerProfile.storeName}
              </Link>
              {product.ratingCount > 0 && (
                <>
                  <span className="text-navy/30">·</span>
                  <span className="flex items-center gap-1 text-sm text-navy/70">
                    <span className="font-mono font-bold text-navy">{Number(product.ratingAverage).toFixed(1)}</span>
                    <span className="text-cargo-yellow-dark">★</span>
                    <span className="text-navy/50">({product.ratingCount})</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-cream/50 p-4">
            <span className="font-mono text-3xl font-extrabold text-navy">
              {isAuction
                ? product.price
                  ? `$${product.price}`
                  : '—'
                : product.price
                  ? `$${product.price}`
                  : '—'}
            </span>
            {isAuction && <span className="ml-2 text-sm font-semibold text-navy/50">starting price</span>}
            <p className="mt-1 text-xs text-navy/50">
              {isAvailable ? `${product.stockQuantity} in stock` : 'Currently unavailable'} · ships from {product.sellerProfile.storeName}
            </p>
          </div>

          {isAuction ? (
            <AuctionPanel productId={product.id} />
          ) : isAuthenticated && user?.role !== 'CUSTOMER' ? (
            <p className="text-sm text-navy/50">Only customer accounts can add items to a cart.</p>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <label className="grid gap-1 text-sm font-medium text-navy" htmlFor="product-quantity">
                Quantity
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</Button>
                  <input id="product-quantity" type="number" min={1} max={product.stockQuantity} value={quantity} onChange={(event) => setQuantity(clampPurchaseQuantity(Number(event.target.value), product.stockQuantity))} className="w-20 rounded-xl border border-line bg-white px-3 py-2 text-center text-sm" />
                  <Button type="button" variant="ghost" size="sm" disabled={quantity >= product.stockQuantity} onClick={() => setQuantity((value) => Math.min(product.stockQuantity, value + 1))} aria-label="Increase quantity">+</Button>
                </div>
              </label>
              {!isAuthenticated ? (
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => navigate('/login', { state: { from: { pathname: `/product/${id}` } } })}
                >
                  Sign in to add to cart
                </Button>
              ) : (
                <Button
                  size="lg"
                  disabled={!isAvailable || addToCart.isPending}
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setAddToCartError(null);
                    addToCart.mutate(
                      { productId: product.id, quantity },
                      {
                        onSuccess: () => {
                          setJustAdded(true);
                          setTimeout(() => setJustAdded(false), 4000);
                        },
                        onError: (error) => setAddToCartError(getApiErrorMessage(error)),
                      },
                    );
                  }}
                >
                  {!isAvailable ? 'Sold out' : addToCart.isPending ? 'Adding…' : 'Add to cart'}
                </Button>
              )}
              {justAdded && (
                <div className="flex items-center gap-3 rounded-xl bg-mint/10 px-3 py-2 text-sm">
                  <span className="font-semibold text-mint">Added to cart ✓</span>
                  <Link to="/cart" className="font-semibold text-crew-blue hover:underline">View cart</Link>
                </div>
              )}
              {addToCartError && <p className="text-sm text-coral">{addToCartError}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 border-t border-line pt-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold text-navy">Description</h2>
          <p className="text-sm text-navy/70">{product.description ?? 'No description yet.'}</p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display text-sm font-bold text-navy">Sold by</h2>
          <Link to={`/catalog?sellerId=${product.sellerProfile.id}`} className="text-sm font-semibold text-crew-blue hover:underline">
            {product.sellerProfile.storeName}
          </Link>
          <Link to={`/catalog?sellerId=${product.sellerProfile.id}`} className="text-xs font-semibold text-navy/60 hover:text-crew-blue">
            View this seller&apos;s stall →
          </Link>
        </div>
      </div>

      <ReviewPanel productId={product.id} />

      {/* Mobile sticky CTA — the square hero image pushes the main "Add to
       * cart" button below the fold on small screens, so repeat it here
       * for the common case (authenticated customer, in-stock, fixed
       * price). Other states already have a tailored primary action
       * higher up the page. */}
      {!isAuction && isAvailable && isAuthenticated && user?.role === 'CUSTOMER' && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-white p-3 sm:hidden">
          <span className="font-mono text-lg font-extrabold text-navy">${product.price}</span>
          <Button
            disabled={addToCart.isPending}
            onClick={() => {
              setAddToCartError(null);
              addToCart.mutate(
                { productId: product.id, quantity },
                {
                  onSuccess: () => { setJustAdded(true); setTimeout(() => setJustAdded(false), 4000); },
                  onError: (error) => setAddToCartError(getApiErrorMessage(error)),
                },
              );
            }}
          >
            {addToCart.isPending ? 'Adding…' : 'Add to cart'}
          </Button>
        </div>
      )}
    </div>
  );
}
