import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCart, useClearCart, useRemoveCartItem, useUpdateCartItem } from '../../features/cart/hooks';
import type { CartItemView } from '../../types/cart';

function CartLineItem({ item }: { item: CartItemView }) {
  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveCartItem();
  const isMutating = updateMutation.isPending || removeMutation.isPending;

  function setQuantity(next: number) {
    if (next < 1 || next > item.availableStock) return;
    updateMutation.mutate({ productId: item.productId, quantity: next });
  }

  return (
    <div className="flex items-center gap-4 py-3">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-xl bg-cream" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-navy">{item.productName}</p>
        <p className="text-sm text-navy/60">${item.unitPrice} each · {item.availableStock} in stock</p>
      </div>
      <div className="flex items-center gap-2">
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
      <p className="w-20 shrink-0 text-right font-semibold text-navy">${item.lineTotal}</p>
      <Button
        variant="ghost"
        size="sm"
        disabled={isMutating}
        onClick={() => removeMutation.mutate(item.productId)}
        aria-label={`Remove ${item.productName} from cart`}
      >
        Remove
      </Button>
    </div>
  );
}

export function CartPage() {
  const { data: cart, isLoading, isError } = useCart();
  const clearMutation = useClearCart();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Your cart</h1>
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
        <EmptyState title="Couldn't load your cart" description="Try refreshing the page." />
      )}

      {!isLoading && !isError && cart && cart.sellers.length === 0 && (
        <EmptyState
          title="Your cart is empty"
          description="Browse the catalog to find something worth shipping."
          action={
            <Link to="/catalog">
              <Button variant="secondary">Browse the catalog</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !isError && cart && cart.sellers.length > 0 && (
        <div className="flex flex-col gap-4">
          {cart.sellers.map((group) => (
            <Card key={group.sellerProfileId} className="p-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <p className="font-display font-semibold text-navy">{group.storeName}</p>
                <p className="text-sm text-navy/60">Subtotal: ${group.subtotal}</p>
              </div>
              <div className="divide-y divide-line">
                {group.items.map((item) => (
                  <CartLineItem key={item.productId} item={item} />
                ))}
              </div>
            </Card>
          ))}

          <Card className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-navy/60">{cart.itemCount} item(s) across {cart.sellers.length} seller(s)</p>
              <p className="font-display text-xl font-semibold text-navy">Total: ${cart.totalAmount}</p>
            </div>
            <Link to="/checkout">
              <Button size="lg">Proceed to checkout</Button>
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
