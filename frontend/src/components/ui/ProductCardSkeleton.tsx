export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div className="aspect-square animate-pulse bg-cream" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-cream" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-cream" />
        <div className="mt-1 h-5 w-1/3 animate-pulse rounded bg-cream" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        // eslint-disable-next-line react/no-array-index-key -- static placeholder list, index is stable
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
