import type { Product } from '../../types/product';
import { ProductCard } from './ProductCard';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';

interface ProductGridProps {
  products: Product[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ProductGrid({ products, isLoading, isError }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner label="Loading crates…" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Couldn't reach the warehouse"
        description="The catalog API didn't respond. Check that the backend is running and try again."
      />
    );
  }

  if (!products || products.length === 0) {
    return (
      <EmptyState
        title="No crates unpacked yet"
        description="Nothing has been published to the catalog so far — this grid is wired up to the real products API and will fill in as soon as sellers list items."
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
