import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCategories } from '../../features/catalog/useCategories';

export function AdminCategoriesPage() {
  const { data: categories, isLoading, isError } = useCategories();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Categories</h1>

      {isLoading && <Spinner label="Loading categories…" />}

      {isError && (
        <EmptyState title="Couldn't load categories" description="Check that the backend API is reachable." />
      )}

      {!isLoading && !isError && (!categories || categories.length === 0) && (
        <EmptyState
          title="No categories yet"
          description="This list is wired up to the real categories API — create/edit tooling lands once category management is implemented."
        />
      )}

      {categories && categories.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white">
          {categories.map((category) => (
            <li key={category.id} className="px-4 py-3 text-sm text-navy">
              {category.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
