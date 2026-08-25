import { Link } from 'react-router-dom';
import { CategoryShowcase } from '../../components/layout/CategoryShowcase';
import { ProductGrid } from '../../components/ui/ProductGrid';
import { ProductImage } from '../../components/ui/ProductImage';
import { useCatalog } from '../../features/catalog/useCatalog';

const TRUST_POINTS = [
  { label: 'Buyer protection', detail: 'Every order is tracked to your door' },
  { label: 'Verified sellers', detail: 'Every seller is reviewed before they can list' },
  { label: 'Live updates', detail: 'Stock and auction bids update instantly' },
];

/** Small real-product preview shown beside the hero, so "what's here" is
 * answered with pictures, not just words — kept to one compact row. */
function HeroPreview({ products }: { products?: ReturnType<typeof useCatalog>['data'] }) {
  const items = products?.data.slice(0, 4) ?? [];
  if (items.length === 0) return null;

  return (
    <div className="grid w-full max-w-xs grid-cols-2 gap-2 sm:max-w-sm">
      {items.map((product) => (
        <Link
          key={product.id}
          to={`/product/${product.id}`}
          className="aspect-square overflow-hidden rounded-xl border border-line bg-cream"
        >
          <ProductImage product={product} variant="thumbnail" />
        </Link>
      ))}
    </div>
  );
}

export function HomePage() {
  const popular = useCatalog({ page: 1, pageSize: 10, sort: 'rating:desc' });
  const deals = useCatalog({ page: 1, pageSize: 10, sort: 'price:asc', available: true });
  const newArrivals = useCatalog({ page: 1, pageSize: 10, sort: 'createdAt:desc' });
  const auctions = useCatalog({ page: 1, pageSize: 5, type: 'AUCTION', sort: 'createdAt:desc' });

  const hasAuctions = !auctions.isLoading && !auctions.isError && (auctions.data?.data.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-12 pb-4">
      {/* Compact hero: what this site sells, in one glance */}
      <section className="flex flex-col items-start gap-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-md flex-col gap-3">
          <h1 className="font-display text-3xl font-bold text-navy sm:text-4xl">
            Find something you&apos;ll love.
          </h1>
          <p className="text-navy/60">
            Shop thousands of products from independent sellers, or bid live on the auction floor.
          </p>
          <div className="mt-1 flex flex-wrap gap-3">
            <Link to="/catalog" className="inline-flex items-center rounded-full bg-cargo-yellow px-5 py-2.5 text-sm font-bold text-navy hover:bg-cargo-yellow-dark">
              Browse products
            </Link>
            <Link to="/catalog?type=AUCTION" className="inline-flex items-center rounded-full border border-navy/20 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream">
              View live auctions
            </Link>
          </div>
        </div>
        <HeroPreview products={popular.data} />
      </section>

      <CategoryShowcase />

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-navy">Popular products</h2>
          <Link to="/catalog?sort=rating:desc" className="text-sm font-semibold text-crew-blue hover:underline">
            View all
          </Link>
        </div>
        <ProductGrid products={popular.data?.data} isLoading={popular.isLoading} isError={popular.isError} onRetry={() => popular.refetch()} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-navy">Deals</h2>
          <Link to="/catalog?sort=price:asc" className="text-sm font-semibold text-crew-blue hover:underline">
            View all
          </Link>
        </div>
        <ProductGrid products={deals.data?.data} isLoading={deals.isLoading} isError={deals.isError} onRetry={() => deals.refetch()} />
      </section>

      {hasAuctions && (
        <section className="flex flex-col gap-4 rounded-2xl bg-navy px-5 py-6 sm:px-8">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-paper">
              <Badge>Live</Badge>
              Auctions happening now
            </h2>
            <Link to="/catalog?type=AUCTION" className="text-sm font-semibold text-cargo-yellow hover:underline">
              View all
            </Link>
          </div>
          <div className="rounded-2xl bg-paper p-4">
            <ProductGrid products={auctions.data?.data} isLoading={auctions.isLoading} isError={auctions.isError} onRetry={() => auctions.refetch()} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-navy">New arrivals</h2>
          <Link to="/catalog?sort=createdAt:desc" className="text-sm font-semibold text-crew-blue hover:underline">
            View all
          </Link>
        </div>
        <ProductGrid products={newArrivals.data?.data} isLoading={newArrivals.isLoading} isError={newArrivals.isError} onRetry={() => newArrivals.refetch()} />
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {TRUST_POINTS.map((point) => (
            <div key={point.label}>
              <p className="text-sm font-bold text-navy">{point.label}</p>
              <p className="text-xs text-navy/50">{point.detail}</p>
            </div>
          ))}
        </div>
        <Link to="/account/seller" className="text-sm font-semibold text-navy/60 hover:text-crew-blue">
          Want to sell here? →
        </Link>
      </section>
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-coral px-2 py-0.5 text-[11px] font-bold text-paper uppercase">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper" aria-hidden="true" />
      {children}
    </span>
  );
}
