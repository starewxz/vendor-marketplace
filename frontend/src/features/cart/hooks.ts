import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/cart';
import type { CartView } from '../../types/cart';

export const CART_KEY = ['cart'];

export function useCart(enabled = true) {
  return useQuery({ queryKey: CART_KEY, queryFn: api.fetchCart, enabled });
}

interface MutationContext {
  previous: CartView | undefined;
}

/**
 * Quantity changes and removals act on a line item already present in the
 * cached CartView, so the optimistic patch can be computed entirely from
 * data already on the client — no need to guess at server-computed fields.
 * `onMutate` snapshots the previous cache value so `onError` can restore it
 * exactly; `onSettled` always refetches so the optimistic guess is
 * reconciled with the server's real numbers (rounding, stock) either way.
 */
function recomputeTotals(view: CartView): CartView {
  const sellers = view.sellers
    .map((group) => ({
      ...group,
      subtotal: formatCents(group.items.reduce((sum, item) => sum + parseCents(item.lineTotal), 0)),
    }))
    .filter((group) => group.items.length > 0);
  const itemCount = sellers.reduce(
    (count, group) => count + group.items.reduce((sum, item) => sum + item.quantity, 0),
    0,
  );
  const totalAmount = formatCents(sellers.reduce((sum, group) => sum + parseCents(group.subtotal), 0));
  return { sellers, itemCount, totalAmount };
}

function parseCents(value: string): number {
  return Math.round(Number(value) * 100);
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      api.updateCartItem(productId, quantity),
    onMutate: async ({ productId, quantity }): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: CART_KEY });
      const previous = queryClient.getQueryData<CartView>(CART_KEY);
      if (previous) {
        const next: CartView = {
          ...previous,
          sellers: previous.sellers.map((group) => ({
            ...group,
            items: group.items.map((item) =>
              item.productId === productId
                ? {
                    ...item,
                    quantity,
                    lineTotal: formatCents(parseCents(item.unitPrice) * quantity),
                  }
                : item,
            ),
          })),
        };
        queryClient.setQueryData(CART_KEY, recomputeTotals(next));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_KEY }),
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => api.removeCartItem(productId),
    onMutate: async (productId): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: CART_KEY });
      const previous = queryClient.getQueryData<CartView>(CART_KEY);
      if (previous) {
        const next: CartView = {
          ...previous,
          sellers: previous.sellers.map((group) => ({
            ...group,
            items: group.items.filter((item) => item.productId !== productId),
          })),
        };
        queryClient.setQueryData(CART_KEY, recomputeTotals(next));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_KEY }),
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.clearCart,
    onMutate: async (): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: CART_KEY });
      const previous = queryClient.getQueryData<CartView>(CART_KEY);
      queryClient.setQueryData<CartView>(CART_KEY, { sellers: [], itemCount: 0, totalAmount: '0.00' });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_KEY }),
  });
}

/** Adding a new product needs server-computed pricing/seller grouping it
 * doesn't have client-side, so this stays a plain invalidate-on-success
 * mutation (the established pattern elsewhere in this codebase) rather
 * than a guessed optimistic insert. */
export function useAddCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      api.addCartItem(productId, quantity),
    onSuccess: (data) => queryClient.setQueryData(CART_KEY, data),
  });
}
