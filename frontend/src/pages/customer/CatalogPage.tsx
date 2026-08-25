import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductGrid } from '../../components/ui/ProductGrid';
import { Button } from '../../components/ui/Button';
import { useCatalog } from '../../features/catalog/useCatalog';
import { useCategories } from '../../features/catalog/useCategories';
import type { CatalogQuery } from '../../types/catalog';
import type { ProductType } from '../../types/product';

const PAGE_SIZE = 20;
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Relevance' },
  { value: 'createdAt:desc', label: 'Newest' },
  { value: 'price:asc', label: 'Price: low to high' },
  { value: 'price:desc', label: 'Price: high to low' },
  { value: 'rating:desc', label: 'Top rated' },
];

function FacetGroup({
  title,
  facet,
  paramKey,
  labelFor,
  searchParams,
  setParam,
}: {
  title: string;
  facet: Record<string, number> | undefined;
  paramKey: string;
  labelFor?: (key: string) => string;
  searchParams: URLSearchParams;
  setParam: (key: string, value: string | null) => void;
}) {
  if (!facet || Object.keys(facet).length === 0) return null;
  const active = searchParams.get(paramKey);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold tracking-wide text-navy/50 uppercase">{title}</h3>
      <div className="flex flex-col gap-1">
        {Object.entries(facet).map(([key, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setParam(paramKey, active === key ? null : key)}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors ${
              active === key ? 'bg-cargo-yellow text-navy' : 'text-navy/70 hover:bg-cream'
            }`}
          >
            <span>{labelFor ? labelFor(key) : key}</span>
            <span className={active === key ? 'text-xs font-semibold text-navy/60' : 'text-xs text-navy/40'}>{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface FilterPanelProps {
  query: CatalogQuery;
  data: ReturnType<typeof useCatalog>['data'];
  searchParams: URLSearchParams;
  setParam: (key: string, value: string | null) => void;
  setSearchParams: (params: URLSearchParams) => void;
  categoryNameById: Map<string, string>;
  sellerNameById: Map<string, string>;
  hasActiveFilters: boolean;
}

function FilterPanel({ query, data, searchParams, setParam, setSearchParams, categoryNameById, sellerNameById, hasActiveFilters }: FilterPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={() => setSearchParams(new URLSearchParams())} className="w-fit">
          Clear filters
        </Button>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold tracking-wide text-navy/50 uppercase">Price</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            defaultValue={query.minPrice ?? ''}
            onBlur={(e) => setParam('minPrice', e.target.value)}
            className="w-full rounded-lg border border-line px-2 py-1.5 text-sm"
          />
          <span className="text-navy/40">–</span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            defaultValue={query.maxPrice ?? ''}
            onBlur={(e) => setParam('maxPrice', e.target.value)}
            className="w-full rounded-lg border border-line px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <FacetGroup
        title="Category"
        facet={data?.facets?.categoryId}
        paramKey="categoryId"
        labelFor={(id) => categoryNameById.get(id) ?? id}
        searchParams={searchParams}
        setParam={setParam}
      />
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold tracking-wide text-navy/50 uppercase">Minimum rating</h3>
        <select value={query.minRating ?? ''} onChange={(event) => setParam('minRating', event.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-navy" aria-label="Minimum rating">
          <option value="">Any rating</option>
          <option value="4">4★ and up</option>
          <option value="3">3★ and up</option>
          <option value="2">2★ and up</option>
          <option value="1">1★ and up</option>
        </select>
      </div>
      <FacetGroup
        title="Seller"
        facet={data?.facets?.sellerId}
        paramKey="sellerId"
        labelFor={(id) => sellerNameById.get(id) ?? `Seller ${id.slice(0, 6)}`}
        searchParams={searchParams}
        setParam={setParam}
      />
      <FacetGroup
        title="Availability"
        facet={data?.facets?.available}
        paramKey="available"
        labelFor={(key) => (key === 'true' ? 'In stock' : 'Sold out')}
        searchParams={searchParams}
        setParam={setParam}
      />
      <FacetGroup
        title="Type"
        facet={data?.facets?.productType}
        paramKey="type"
        labelFor={(key) => (key === 'FIXED_PRICE' ? 'Fixed price' : 'Auction')}
        searchParams={searchParams}
        setParam={setParam}
      />
    </div>
  );
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories } = useCategories();
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const query: CatalogQuery = {
    search: searchParams.get('search') ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    sellerId: searchParams.get('sellerId') ?? undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    minRating: searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined,
    available: searchParams.get('available') === 'true' ? true : undefined,
    type: (searchParams.get('type') as ProductType | null) ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, isError, refetch } = useCatalog(query);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete('page'); // any filter change resets pagination
    setSearchParams(next);
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next);
  }

  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const sellerNameById = new Map((data?.data ?? []).map((product) => [product.sellerId, product.sellerName]));
  const activeFilterKeys = ['categoryId', 'sellerId', 'minPrice', 'maxPrice', 'minRating', 'available', 'type'];
  const hasActiveFilters = activeFilterKeys.some((k) => searchParams.has(k));
  const activeFilterCount = activeFilterKeys.filter((k) => searchParams.has(k)).length;

  const panelProps: FilterPanelProps = { query, data, searchParams, setParam, setSearchParams, categoryNameById, sellerNameById, hasActiveFilters };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-navy">
        {query.search ? `Results for "${query.search}"` : 'Full catalog'}
      </h1>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="hidden md:block">
          <div className="sticky top-24 flex flex-col gap-6 rounded-2xl border border-line bg-white p-4 md:p-5">
            <FilterPanel {...panelProps} />
          </div>
        </aside>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-cream/60 px-3 py-2">
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-navy/25 bg-white px-3 py-1.5 text-xs font-bold text-navy md:hidden"
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-coral text-[10px] text-paper">{activeFilterCount}</span>
              )}
            </button>
            <span className="hidden text-xs font-bold tracking-wide text-navy/50 uppercase md:inline">
              {data ? `${data.meta.total} result${data.meta.total === 1 ? '' : 's'}` : ' '}
            </span>
            <select
              value={query.sort ?? ''}
              onChange={(e) => setParam('sort', e.target.value)}
              className="ml-auto rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-navy"
              aria-label="Sort"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <ProductGrid
            products={data?.data}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            emptyTitle={query.search ? `No products found for "${query.search}"` : 'No products match these filters'}
            emptyDescription={query.search ? 'Try checking your spelling, or browse categories instead.' : 'Try adjusting or clearing your filters.'}
          />

          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              <Button variant="ghost" size="sm" disabled={query.page === 1} onClick={() => setPage((query.page ?? 1) - 1)}>
                Previous
              </Button>
              <span className="text-sm text-navy/60">
                Page {data.meta.page} of {data.meta.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={query.page === data.meta.totalPages}
                onClick={() => setPage((query.page ?? 1) + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-navy/50"
            onClick={() => setFilterDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col gap-4 overflow-y-auto bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy">Filters</h2>
              <button type="button" onClick={() => setFilterDrawerOpen(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-cream">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
              </button>
            </div>
            <FilterPanel {...panelProps} />
            <Button className="mt-2" onClick={() => setFilterDrawerOpen(false)}>
              Show {data?.meta.total ?? ''} results
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
