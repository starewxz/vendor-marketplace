import { apiClient } from './client';
import type { CustomerOrderDetailView, CustomerOrderListItemView, PaginatedResult } from '../types/order';

export async function fetchMyOrders(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResult<CustomerOrderListItemView>> {
  const { data } = await apiClient.get<PaginatedResult<CustomerOrderListItemView>>('/orders', {
    params: { page, pageSize },
  });
  return data;
}

export async function fetchMyOrder(id: string): Promise<CustomerOrderDetailView> {
  const { data } = await apiClient.get<CustomerOrderDetailView>(`/orders/${id}`);
  return data;
}
