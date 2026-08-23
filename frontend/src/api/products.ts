import { apiClient } from './client';
import type { ProductDetail } from '../types/product';
import type { CatalogQuery, CatalogSearchResult } from '../types/catalog';

export async function fetchCatalog(query: CatalogQuery): Promise<CatalogSearchResult> {
  const { data } = await apiClient.get<CatalogSearchResult>('/products', { params: query });
  return data;
}

export async function fetchProductById(id: string): Promise<ProductDetail> {
  const { data } = await apiClient.get<ProductDetail>(`/products/${id}`);
  return data;
}
