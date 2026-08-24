import { apiClient } from './client';
import type {
  AdminOrderDetailView,
  AdminOrderListItemView,
  AdminSellerOrderView,
  PaginatedResult,
  SellerOrderStatus,
} from '../types/order';

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

export async function fetchAdminSellerOrder(id: string): Promise<AdminSellerOrderView> {
  const { data } = await apiClient.get<AdminSellerOrderView>(`/admin/seller-orders/${id}`);
  return data;
}

export async function updateAdminSellerOrderStatus(
  id: string,
  status: SellerOrderStatus,
): Promise<AdminSellerOrderView> {
  const { data } = await apiClient.patch<AdminSellerOrderView>(`/admin/seller-orders/${id}/status`, {
    status,
  });
  return data;
}

export async function cancelAdminSellerOrder(id: string): Promise<AdminSellerOrderView> {
  const { data } = await apiClient.post<AdminSellerOrderView>(`/admin/seller-orders/${id}/cancel`);
  return data;
}
