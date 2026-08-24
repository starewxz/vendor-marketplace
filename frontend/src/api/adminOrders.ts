import { apiClient } from './client';
import type { AdminOrderDetailView, AdminOrderListItemView, PaginatedResult } from '../types/order';

export async function fetchAllOrders(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResult<AdminOrderListItemView>> {
  const { data } = await apiClient.get<PaginatedResult<AdminOrderListItemView>>('/admin/orders', {
    params: { page, pageSize },
  });
  return data;
}

export async function fetchOrder(id: string): Promise<AdminOrderDetailView> {
  const { data } = await apiClient.get<AdminOrderDetailView>(`/admin/orders/${id}`);
  return data;
}
