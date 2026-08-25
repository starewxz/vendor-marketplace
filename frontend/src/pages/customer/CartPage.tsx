import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProductImage } from '../../components/ui/ProductImage';
import { ProductGrid } from '../../components/ui/ProductGrid';
import { useCart, useClearCart, useRemoveCartItem, useUpdateCartItem } from '../../features/cart/hooks';
import { useCatalog } from '../../features/catalog/useCatalog';
import type { CartItemView } from '../../types/cart';
import { getApiErrorMessage } from '../../api/error';

function CartLineItem({ item }: { item: CartItemView }) {
  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveCartItem();
  const isMutating = updateMutation.isPending || removeMutation.isPending;

  function setQuantity(next: number) {
    if (next < 1 || next > item.availableStock) return;
    updateMutation.mutate({ productId: item.productId, quantity: next });
  }

  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-3 py-3 sm:flex sm:gap-4">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-cream">
        <ProductImage
          product={{ id: item.productId, name: item.productName, imageUrls: item.imageUrl ? [item.imageUrl] : [] }}
          variant="thumbnail"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-navy">{item.productName}</p>
        <p className="text-sm text-navy/60">${item.unitPrice} each · {item.availableStock} in stock</p>
      </div>
      <div className="col-span-2 flex items-center gap-2 rounded-full border border-line sm:col-span-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={isMutating || item.quantity <= 1}
          onClick={() => setQuantity(item.quantity - 1)}
          aria-label={`Decrease quantity of ${item.productName}`}
        >
          −
        </Button>
        <span className="w-6 text-center font-semibold text-navy">{item.quantity}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={isMutating || item.quantity >= item.availableStock}
          onClick={() => setQuantity(item.quantity + 1)}
          aria-label={`Increase quantity of ${item.productName}`}
        >
          +
        </Button>
      </div>
      <p className="ml-auto shrink-0 text-right font-mono font-bold text-navy sm:w-20">${item.lineTotal}</p>
      <Button
        variant="ghost"
        size="sm"
        disabled={isMutating}
        onClick={() => removeMutation.mutate(item.productId)}
        aria-label={`Remove ${item.productName} from cart`}
      >
        Remove
      </Button>
      {(updateMutation.isError || removeMutation.isError) && (
        <p className="col-span-2 text-sm text-coral sm:basis-full">{getApiErrorMessage(updateMutation.error ?? removeMutation.error, 'Cart could not be updated.')}</p>
      )}
    </div>
  );
}

function EmptyCart() {
  const popular = useCatalog({ page: 1, pageSize: 4, sort: 'rating:desc' });
  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        title="Your cart is empty"
        description="Find something you like and add it here."
        action={
          <Link to="/catalog">
            <Button variant="secondary">Browse products</Button>
          </Link>
        }
      />
      {(popular.data?.data.length ?? 0) > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold text-navy">Popular products</h2>
          <ProductGrid products={popular.data?.data} isLoading={popular.isLoading} isError={popular.isError} />
        </div>
      )}
    </div>
  );
}

export function CartPage() {
  const { data: cart, isLoading, isError } = useCart();
  const clearMutation = useClearCart();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Your cart</h1>
          {cart && cart.itemCount > 0 && (
            <p className="text-sm text-navy/55">{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} from {cart.sellers.length} seller{cart.sellers.length === 1 ? '' : 's'}</p>
          )}
        </div>
        {cart && cart.itemCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={clearMutation.isPending}
            onClick={() => clearMutation.mutate()}
          >
            Clear cart
          </Button>
        )}
      </div>

      {isLoading && <Spinner label="Loading your cart…" />}
      {isError && (
        <EmptyState title="We couldn't load your cart" description="Please try refreshing the page." />
      )}

      {!isLoading && !isError && cart && cart.sellers.length === 0 && <EmptyCart />}

      {!isLoading && !isError && cart && cart.sellers.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            {cart.sellers.map((group) => (
              <Card key={group.sellerProfileId} className="overflow-hidden border border-line p-0">
                <div className="flex items-center justify-between gap-3 bg-cream/70 px-4 py-3 sm:px-5">
                  <p className="font-display font-bold text-navy">{group.storeName}</p>
                  <p className="text-sm text-navy/60">Subtotal: <span className="font-mono font-bold text-navy">${group.subtotal}</span></p>
                </div>
                <div className="divide-y divide-line px-4 sm:px-5">
                  {group.items.map((item) => (
                    <CartLineItem key={item.productId} item={item} />
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card className="flex flex-col gap-4 border border-line p-5">
              <h2 className="font-display text-lg font-bold text-navy">Order summary</h2>
              <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm text-navy/60">
                {cart.sellers.map((group) => (
                  <div key={group.sellerProfileId} className="flex justify-between">
                    <span className="truncate pr-2">{group.storeName}</span>
                    <span className="font-mono">${group.subtotal}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-sm font-semibold text-navy/70">Total</span>
                <span className="font-mono text-2xl font-extrabold text-navy">${cart.totalAmount}</span>
              </div>
              <Link to="/checkout">
                <Button size="lg" className="w-full">Checkout</Button>
              </Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
