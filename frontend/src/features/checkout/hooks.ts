import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/checkout';
import type { CheckoutShippingInput } from '../../types/checkout';
import { CART_KEY } from '../cart/hooks';

/**
 * The Idempotency-Key is generated once by the caller (see CheckoutPage,
 * `useState(() => crypto.randomUUID())`) and reused for every submit
 * attempt during that page visit — a double-click or a retried request
 * after a network hiccup replays the same order instead of creating a
 * duplicate. A fresh page visit gets a fresh key, which is fine: a failed
 * checkout never leaves a durable claim on the old key server-side.
 */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      idempotencyKey,
      shipping,
    }: {
      idempotencyKey: string;
      shipping: CheckoutShippingInput;
    }) => api.checkout(idempotencyKey, shipping),
    onSuccess: () => {
      // Checkout clears the server-side cart — drop the stale cached view.
      queryClient.setQueryData(CART_KEY, { sellers: [], itemCount: 0, totalAmount: '0.00' });
    },
  });
}
