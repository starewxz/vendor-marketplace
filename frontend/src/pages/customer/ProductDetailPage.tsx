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

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError } = useProduct(id);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const addToCart = useAddCartItem();
  const [addToCartError, setAddToCartError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
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
    <div className="grid gap-8 md:grid-cols-2">
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-cream/60">
        {product.imageUrls[0] ? (
          <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full rounded-2xl object-cover" />
        ) : (
          <span className="text-sm text-navy/40">No image yet</span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {isAuction && <Badge tone="coral">Auction</Badge>}
          <Badge tone={isAvailable ? 'mint' : 'neutral'}>{isAvailable ? 'In stock' : 'Sold out'}</Badge>
        </div>

        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">{product.name}</h1>
          <Link to={`/catalog?sellerId=${product.sellerProfile.id}`} className="text-sm text-crew-blue hover:underline">
            {product.sellerProfile.storeName}
          </Link>
          <span className="text-sm text-navy/50"> · </span>
          <Link to={`/catalog?categoryId=${product.category.id}`} className="text-sm text-navy/60 hover:underline">
            {product.category.name}
          </Link>
        </div>

        {product.ratingCount > 0 ? (
          <div className="flex items-center gap-1.5 text-sm text-navy/70">
            <span className="font-mono font-semibold text-navy">{Number(product.ratingAverage).toFixed(1)}</span>
            <span>★</span>
            <span className="text-navy/50">({product.ratingCount} review{product.ratingCount === 1 ? '' : 's'})</span>
          </div>
        ) : (
          <p className="text-sm text-navy/50">No reviews yet</p>
        )}

        <span className="font-mono text-2xl font-semibold text-navy">
          {isAuction
            ? product.price
              ? `Starting at $${product.price}`
              : 'Auction — starting price set at listing'
            : product.price
              ? `$${product.price}`
              : '—'}
        </span>

        <p className="text-sm text-navy/70">{product.description ?? 'No description yet.'}</p>

        <p className="text-xs text-navy/40">{product.stockQuantity} in stock</p>

        {isAuction ? (
          <AuctionPanel productId={product.id} />
        ) : isAuthenticated && user?.role !== 'CUSTOMER' ? (
          <p className="text-sm text-navy/50">Only customer accounts can add items to a cart.</p>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <Button
              disabled={!isAvailable || addToCart.isPending}
              className="w-fit"
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login', { state: { from: { pathname: `/product/${id}` } } });
                  return;
                }
                setAddToCartError(null);
                addToCart.mutate(
                  { productId: product.id, quantity: 1 },
                  {
                    onSuccess: () => {
                      setJustAdded(true);
                      setTimeout(() => setJustAdded(false), 2000);
                    },
                    onError: (error) => setAddToCartError(getApiErrorMessage(error)),
                  },
                );
              }}
            >
              {!isAvailable
                ? 'Sold out'
                : addToCart.isPending
                  ? 'Adding…'
                  : justAdded
                    ? 'Added to cart ✓'
                    : 'Add to cart'}
            </Button>
            {addToCartError && <p className="text-sm text-coral">{addToCartError}</p>}
          </div>
        )}
      </div>
      <ReviewPanel productId={product.id} />
    </div>
  );
}
