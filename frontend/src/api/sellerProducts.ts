import { apiClient } from './client';
import type { ProductFormInput, SellerProduct } from '../types/product';

export async function fetchMyProducts(): Promise<SellerProduct[]> {
  const { data } = await apiClient.get<SellerProduct[]>('/seller/products');
  return data;
}

export async function fetchMyProduct(id: string): Promise<SellerProduct> {
  const { data } = await apiClient.get<SellerProduct>(`/seller/products/${id}`);
  return data;
}

export async function createProduct(input: ProductFormInput): Promise<SellerProduct> {
  const { data } = await apiClient.post<SellerProduct>('/seller/products', input);
  return data;
}

export async function updateProduct(id: string, input: Partial<ProductFormInput>): Promise<SellerProduct> {
  const { data } = await apiClient.patch<SellerProduct>(`/seller/products/${id}`, input);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/seller/products/${id}`);
}
