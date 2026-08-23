import { Link, useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useProduct } from '../../features/catalog/useProduct';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError } = useProduct(id);

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
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line bg-cream/40 p-4">
            <p className="text-sm font-medium text-navy">Bidding isn't open yet</p>
            <p className="text-xs text-navy/60">
              This is an auction listing — live bidding, current price, and time remaining land in a later stage.
            </p>
          </div>
        ) : (
          <Button disabled={!isAvailable} className="w-fit">
            {isAvailable ? 'Add to cart (coming soon)' : 'Sold out'}
          </Button>
        )}
      </div>
    </div>
  );
}
