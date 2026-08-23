import { Link } from 'react-router-dom';

/**
 * Static nav taxonomy for the foundation shell. Once CategoriesModule's
 * endpoint is consumed here (Stage 2+), this list is replaced by a
 * useQuery(['categories']) call — the chip markup itself won't change.
 */
const PLACEHOLDER_CATEGORIES = [
  'Deals',
  'Electronics',
  'Home & Garden',
  'Fashion',
  'Toys & Games',
  'Auctions',
  'Sports',
  'Beauty',
];

export function CategoryChips() {
  return (
    <nav aria-label="Categories" className="flex gap-2 overflow-x-auto px-4 py-2.5 sm:px-6">
      {PLACEHOLDER_CATEGORIES.map((category) => (
        <Link
          key={category}
          to={`/catalog?category=${encodeURIComponent(category)}`}
          className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium text-navy/80 whitespace-nowrap hover:border-crew-blue hover:text-crew-blue"
        >
          {category}
        </Link>
      ))}
    </nav>
  );
}
