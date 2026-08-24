import { apiClient } from './client';
import type { PaginatedResult, SellerOrderDetailView, SellerOrderListItemView } from '../types/order';

export async function fetchMySellerOrders(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResult<SellerOrderListItemView>> {
  const { data } = await apiClient.get<PaginatedResult<SellerOrderListItemView>>('/seller/orders', {
    params: { page, pageSize },
  });
  return data;
}

export async function fetchMySellerOrder(id: string): Promise<SellerOrderDetailView> {
  const { data } = await apiClient.get<SellerOrderDetailView>(`/seller/orders/${id}`);
  return data;
}
