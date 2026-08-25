import { Link } from 'react-router-dom';
import { useCategories } from '../../features/catalog/useCategories';
import { resolveCategoryImageUrl, withImageParams } from '../../lib/productImages';

/** Homepage "shop by category" rail — image-forward tiles, distinct from
 * the header's compact chip row, so the homepage doesn't read as a bare
 * list of links. */
export function CategoryShowcase() {
  const { data: categories } = useCategories();

  if (!categories || categories.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-bold text-navy">Shop by category</h2>
        <Link to="/catalog" className="text-sm font-bold text-crew-blue hover:underline">
          Browse all →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
        {categories.slice(0, 7).map((category) => {
          const image = resolveCategoryImageUrl(category.name);
          return (
            <Link key={category.id} to={`/catalog?categoryId=${category.id}`} className="group flex flex-col items-center gap-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-full border border-line bg-cream transition-all group-hover:border-cargo-yellow-dark">
                {image ? (
                  <img
                    src={withImageParams(image, 'w=200&q=60&auto=format&fit=crop')}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-navy/25">
                    <span className="lens-dots"><span /><span /></span>
                  </div>
                )}
              </div>
              <span className="line-clamp-1 text-center text-xs font-bold text-navy">{category.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
