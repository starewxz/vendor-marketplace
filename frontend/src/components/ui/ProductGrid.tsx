import { Link } from 'react-router-dom';
import type { CatalogProduct } from '../../types/product';
import { ProductCard } from './ProductCard';
import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { ProductGridSkeleton } from './ProductCardSkeleton';

interface ProductGridProps {
  products: CatalogProduct[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ProductGrid({
  products,
  isLoading,
  isError,
  onRetry,
  emptyTitle = 'No products found',
  emptyDescription = 'Try a different search or clear your filters.',
}: ProductGridProps) {
  if (isLoading) {
    return <ProductGridSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        title="We couldn't load these products"
        description="Something went wrong reaching the catalog."
        action={onRetry ? <Button variant="secondary" onClick={onRetry}>Try again</Button> : undefined}
      />
    );
  }

  if (!products || products.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Link to="/catalog">
            <Button variant="secondary">Browse all products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
