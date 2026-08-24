import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCart } from '../../features/cart/hooks';
import { useCheckout } from '../../features/checkout/hooks';
import { getApiErrorMessage } from '../../api/error';
import type { CheckoutShippingInput } from '../../types/checkout';

export function CheckoutPage() {
  const { data: cart, isLoading, isError } = useCart();
  const checkoutMutation = useCheckout();
  const navigate = useNavigate();

  // Generated once per page visit — every submit attempt during this visit
  // (including a double-click or a retry after a network error) reuses the
  // same key, so it replays instead of creating a duplicate order. See
  // features/checkout/hooks.ts.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [shipping, setShipping] = useState<CheckoutShippingInput>({});
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof CheckoutShippingInput>(field: K, value: string) {
    setShipping((prev) => ({ ...prev, [field]: value || undefined }));
  }

  function handleSubmit() {
    setError(null);
    checkoutMutation.mutate(
      { idempotencyKey, shipping },
      {
        onSuccess: (result) => {
          navigate(`/account/orders/${result.orderId}`, {
            state: { justPlaced: true },
            replace: true,
          });
        },
        onError: (err) => setError(getApiErrorMessage(err, 'Checkout failed. Your cart is unchanged — try again.')),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner label="Loading your cart…" />
      </div>
    );
  }

  if (isError || !cart) {
    return <EmptyState title="Couldn't load your cart" description="Try refreshing the page." />;
  }

  if (cart.sellers.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add something to your cart before checking out."
        action={
          <Link to="/catalog">
            <Button variant="secondary">Browse the catalog</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-navy">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {cart.sellers.map((group) => (
            <Card key={group.sellerProfileId} className="p-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <p className="font-display font-semibold text-navy">{group.storeName}</p>
                <p className="text-sm text-navy/60">Subtotal: ${group.subtotal}</p>
              </div>
              <div className="divide-y divide-line">
                {group.items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-navy">{item.productName}</p>
                      <p className="text-sm text-navy/60">
                        {item.quantity} × ${item.unitPrice}
                      </p>
                    </div>
                    <p className="font-semibold text-navy">${item.lineTotal}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card className="flex flex-col gap-3 p-5">
            <p className="font-display font-semibold text-navy">Shipping address (optional)</p>
            <Input
              label="Address line 1"
              value={shipping.shippingAddressLine1 ?? ''}
              onChange={(e) => updateField('shippingAddressLine1', e.target.value)}
            />
            <Input
              label="Address line 2"
              value={shipping.shippingAddressLine2 ?? ''}
              onChange={(e) => updateField('shippingAddressLine2', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                value={shipping.shippingCity ?? ''}
                onChange={(e) => updateField('shippingCity', e.target.value)}
              />
              <Input
                label="Postal code"
                value={shipping.shippingPostalCode ?? ''}
                onChange={(e) => updateField('shippingPostalCode', e.target.value)}
              />
            </div>
            <Input
              label="Country"
              value={shipping.shippingCountry ?? ''}
              onChange={(e) => updateField('shippingCountry', e.target.value)}
            />
          </Card>
        </div>

        <Card className="flex h-fit flex-col gap-4 p-5">
          <p className="font-display font-semibold text-navy">Order summary</p>
          <div className="flex justify-between text-sm text-navy/70">
            <span>{cart.itemCount} item(s), {cart.sellers.length} seller(s)</span>
          </div>
          <div className="flex justify-between border-t border-line pt-3 font-display text-lg font-semibold text-navy">
            <span>Total</span>
            <span>${cart.totalAmount}</span>
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
          <Button
            size="lg"
            className="w-full"
            disabled={checkoutMutation.isPending}
            onClick={handleSubmit}
          >
            {checkoutMutation.isPending ? 'Placing order…' : 'Place order'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
