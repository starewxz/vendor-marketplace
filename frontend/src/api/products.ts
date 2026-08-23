import { apiClient } from './client';
import type { Product } from '../types/product';

export async function fetchPublishedProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>('/products');
  return data;
}

export async function fetchProductById(id: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/products/${id}`);
  return data;
}
