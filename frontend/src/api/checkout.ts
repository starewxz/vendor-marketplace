import { apiClient } from './client';
import type { CheckoutResult, CheckoutShippingInput } from '../types/checkout';

export async function checkout(
  idempotencyKey: string,
  shipping: CheckoutShippingInput,
): Promise<CheckoutResult> {
  const { data } = await apiClient.post<CheckoutResult>('/cart/checkout', shipping, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data;
}
