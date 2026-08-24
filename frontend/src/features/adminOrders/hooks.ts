import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/adminOrders';
import type { SellerOrderStatus } from '../../types/order';

export function useAllOrders(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['admin-orders', page, pageSize],
    queryFn: () => api.fetchAllOrders(page, pageSize),
  });
}

export function useAdminOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-orders', id],
    queryFn: () => api.fetchOrder(id as string),
    enabled: Boolean(id),
  });
}

export function useAdminSellerOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-seller-orders', id],
    queryFn: () => api.fetchAdminSellerOrder(id as string),
    enabled: Boolean(id),
  });
}

export function useUpdateAdminSellerOrderStatus(id: string, parentOrderId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: SellerOrderStatus) => api.updateAdminSellerOrderStatus(id, status),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-seller-orders', id], data);
      if (parentOrderId) void queryClient.invalidateQueries({ queryKey: ['admin-orders', parentOrderId] });
    },
  });
}

export function useCancelAdminSellerOrder(id: string, parentOrderId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelAdminSellerOrder(id),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-seller-orders', id], data);
      if (parentOrderId) void queryClient.invalidateQueries({ queryKey: ['admin-orders', parentOrderId] });
    },
  });
}
