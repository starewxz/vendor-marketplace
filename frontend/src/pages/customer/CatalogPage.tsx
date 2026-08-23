import { useSearchParams } from 'react-router-dom';
import { ProductGrid } from '../../components/ui/ProductGrid';
import { useProducts } from '../../features/catalog/useProducts';

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const category = searchParams.get('category');
  const { data: products, isLoading, isError } = useProducts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy">
          {query ? `Results for "${query}"` : category ? category : 'Full catalog'}
        </h1>
        <p className="text-sm text-navy/60">
          Search and category filtering will narrow this list once Meilisearch sync ships — right now it lists every
          published product.
        </p>
      </div>
      <ProductGrid products={products} isLoading={isLoading} isError={isError} />
    </div>
  );
}
