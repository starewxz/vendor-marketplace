import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProductFormModal } from '../../components/seller/ProductFormModal';
import { useDeleteProduct, useMyProducts } from '../../features/sellerProducts/hooks';
import type { SellerProduct } from '../../types/product';
import { getApiErrorMessage } from '../../api/error';

export function SellerProductsPage() {
  const { data: products, isLoading, isError } = useMyProducts();
  const deleteMutation = useDeleteProduct();
  const [editing, setEditing] = useState<SellerProduct | 'new' | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Your products</h1>
        <Button onClick={() => setEditing('new')}>Add product</Button>
      </div>

      {isLoading && <Spinner label="Loading your products…" />}
      {isError && <EmptyState title="Couldn't load your products" description="Try refreshing the page." />}
      {deleteError && <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{deleteError}</p>}

      {!isLoading && !isError && (!products || products.length === 0) && (
        <EmptyState title="No products yet" description="Add your first product to start selling." />
      )}

      <div className="flex flex-col gap-3">
        {products?.map((product) => (
          <Card key={product.id} className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-navy">{product.name}</p>
                <Badge tone={product.isPublished ? 'mint' : 'neutral'}>
                  {product.isPublished ? 'Published' : 'Draft'}
                </Badge>
                {product.type === 'AUCTION' && <Badge tone="coral">Auction</Badge>}
              </div>
              <p className="text-sm text-navy/60">
                {product.price ? `$${product.price}` : 'No price set'} · {product.stockQuantity} in stock
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {product.type === 'AUCTION' && <Link to="/seller/auctions"><Button size="sm" variant="secondary">Configure auction</Button></Link>}
              <Button size="sm" variant="ghost" onClick={() => setEditing(product)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (confirm(`Delete "${product.name}"? This can't be undone.`)) {
                    setDeleteError(null);
                    deleteMutation.mutate(product.id, { onError: (cause) => setDeleteError(getApiErrorMessage(cause, 'Product could not be deleted.')) });
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <ProductFormModal product={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
