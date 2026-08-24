import { apiClient } from './client';
import type { CartView } from '../types/cart';

export async function fetchCart(): Promise<CartView> {
  const { data } = await apiClient.get<CartView>('/cart');
  return data;
}

export async function addCartItem(productId: string, quantity: number): Promise<CartView> {
  const { data } = await apiClient.post<CartView>('/cart/items', { productId, quantity });
  return data;
}

export async function updateCartItem(productId: string, quantity: number): Promise<CartView> {
  const { data } = await apiClient.patch<CartView>(`/cart/items/${productId}`, { quantity });
  return data;
}

export async function removeCartItem(productId: string): Promise<CartView> {
  const { data } = await apiClient.delete<CartView>(`/cart/items/${productId}`);
  return data;
}

export async function clearCart(): Promise<CartView> {
  const { data } = await apiClient.delete<CartView>('/cart');
  return data;
}
