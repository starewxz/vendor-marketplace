import { useState, type FormEvent } from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCategories } from '../../features/catalog/useCategories';
import { useCreateProduct, useUpdateProduct } from '../../features/sellerProducts/hooks';
import { getApiErrorMessage } from '../../api/error';
import type { ProductFormInput, ProductType, SellerProduct } from '../../types/product';

interface ProductFormModalProps {
  product?: SellerProduct;
  onClose: () => void;
}

export function ProductFormModal({ product, onClose }: ProductFormModalProps) {
  const { data: categories } = useCategories();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ProductFormInput>({
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? '',
    type: product?.type ?? 'FIXED_PRICE',
    price: product?.price ?? '',
    stockQuantity: product?.stockQuantity ?? 0,
    imageUrls: product?.imageUrls ?? [],
    isPublished: product?.isPublished ?? true,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const input: ProductFormInput = {
      ...form,
      price: form.type === 'FIXED_PRICE' ? form.price : undefined,
    };

    const onError = (err: unknown) => setError(getApiErrorMessage(err, 'Could not save this product.'));

    if (product) {
      updateMutation.mutate({ id: product.id, input }, { onSuccess: onClose, onError });
    } else {
      createMutation.mutate(input, { onSuccess: onClose, onError });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy/40 px-4 py-8">
      <Card className="flex w-full max-w-lg flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-semibold text-navy">
          {product ? 'Edit product' : 'New product'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="name"
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />

          <label className="flex flex-col gap-1.5 text-sm font-medium text-navy" htmlFor="description">
            Description
            <textarea
              id="description"
              className="min-h-20 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy focus-visible:border-crew-blue"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-navy" htmlFor="categoryId">
            Category
            <select
              id="categoryId"
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              required
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-navy" htmlFor="type">
            Type
            <select
              id="type"
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ProductType }))}
            >
              <option value="FIXED_PRICE">Fixed price</option>
              <option value="AUCTION">Auction</option>
            </select>
          </label>

          {form.type === 'AUCTION' && (
            <p className="rounded-lg bg-cream px-3 py-2 text-xs text-navy/60">
              Auction pricing, start/end times, and bidding are configured in a later stage — this just creates the
              product listing itself.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {form.type === 'FIXED_PRICE' && (
              <Input
                id="price"
                label="Price ($)"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            )}
            <Input
              id="stockQuantity"
              label="Stock"
              type="number"
              min={0}
              value={form.stockQuantity}
              onChange={(e) => setForm((f) => ({ ...f, stockQuantity: Number(e.target.value) }))}
              required
            />
          </div>

          <Input
            id="imageUrl"
            label="Image URL (optional)"
            value={form.imageUrls?.[0] ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, imageUrls: e.target.value ? [e.target.value] : [] }))}
          />

          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
            />
            Published (visible in the public catalog)
          </label>

          {error && <p className="text-sm text-coral">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save product'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
