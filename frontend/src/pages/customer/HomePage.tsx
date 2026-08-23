import { PromoTiles } from '../../components/layout/PromoTiles';
import { ProductGrid } from '../../components/ui/ProductGrid';
import { useProducts } from '../../features/catalog/useProducts';

export function HomePage() {
  const { data: products, isLoading, isError } = useProducts();

  return (
    <div className="flex flex-col gap-10">
      <PromoTiles />

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold text-navy">Fresh off the truck</h2>
        </div>
        <ProductGrid products={products} isLoading={isLoading} isError={isError} />
      </section>
    </div>
  );
}
