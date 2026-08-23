import { useState, type FormEvent } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCategories } from '../../features/catalog/useCategories';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '../../features/adminCategories/hooks';
import { getApiErrorMessage } from '../../api/error';
import type { Category } from '../../types/category';

function CategoryForm({ category, onDone }: { category?: Category; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const onError = (err: unknown) => setError(getApiErrorMessage(err, 'Could not save this category.'));

    if (category) {
      updateMutation.mutate({ id: category.id, input: { name } }, { onSuccess: onDone, onError });
    } else {
      createMutation.mutate({ name }, { onSuccess: onDone, onError });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" required />
      <Button type="submit" size="sm" disabled={isPending}>
        {category ? 'Save' : 'Add'}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      {error && <p className="text-sm text-coral">{error}</p>}
    </form>
  );
}

export function AdminCategoriesPage() {
  const { data: categories, isLoading, isError } = useCategories();
  const deleteMutation = useDeleteCategory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete(category: Category) {
    if (!confirm(`Delete "${category.name}"?`)) return;
    setDeleteError(null);
    deleteMutation.mutate(category.id, {
      onError: (err) => setDeleteError(getApiErrorMessage(err, 'Could not delete this category.')),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Categories</h1>
        {!creating && <Button onClick={() => setCreating(true)}>Add category</Button>}
      </div>

      {creating && (
        <Card className="p-4">
          <CategoryForm onDone={() => setCreating(false)} />
        </Card>
      )}

      {deleteError && <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{deleteError}</p>}

      {isLoading && <Spinner label="Loading categories…" />}

      {isError && (
        <EmptyState title="Couldn't load categories" description="Check that the backend API is reachable." />
      )}

      {!isLoading && !isError && (!categories || categories.length === 0) && !creating && (
        <EmptyState title="No categories yet" description="Add your first category to organize the catalog." />
      )}

      {categories && categories.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between px-4 py-3">
              {editingId === category.id ? (
                <div className="flex-1">
                  <CategoryForm category={category} onDone={() => setEditingId(null)} />
                </div>
              ) : (
                <>
                  <span className="text-sm text-navy">{category.name}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(category.id)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(category)}>
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
