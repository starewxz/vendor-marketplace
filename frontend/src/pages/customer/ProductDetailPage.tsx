import { useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
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
        <h1 className="font-display text-2xl font-semibold text-navy">{product.name}</h1>
        <span className="font-mono text-2xl font-semibold text-navy">
          {product.price ? `$${product.price}` : 'Price set at auction'}
        </span>
        <p className="text-sm text-navy/70">{product.description ?? 'No description yet.'}</p>
        <Button disabled className="w-fit">
          Add to cart (Stage 3)
        </Button>
      </div>
    </div>
  );
}
