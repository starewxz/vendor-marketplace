import { Link } from 'react-router-dom';
import { useCategories } from '../../features/catalog/useCategories';

export function CategoryChips() {
  const { data: categories } = useCategories();

  if (!categories || categories.length === 0) return null;

  return (
    <nav aria-label="Categories" className="flex gap-2 overflow-x-auto px-4 py-2.5 sm:px-6">
      {categories.slice(0, 10).map((category) => (
        <Link
          key={category.id}
          to={`/catalog?categoryId=${category.id}`}
          className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-navy/80 whitespace-nowrap hover:border-crew-blue hover:text-crew-blue"
        >
          {category.name}
        </Link>
      ))}
      {categories.length > 10 && (
        <Link
          to="/catalog"
          className="shrink-0 rounded-full border border-navy/20 bg-cream px-3.5 py-1.5 text-sm font-semibold text-navy whitespace-nowrap hover:border-crew-blue hover:text-crew-blue"
        >
          Browse all
        </Link>
      )}
    </nav>
  );
}
