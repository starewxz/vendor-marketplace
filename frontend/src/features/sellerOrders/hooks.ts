import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/sellerOrders';
import type { SellerOrderStatus } from '../../types/order';

export function useMySellerOrders(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['seller-orders', 'me', page, pageSize],
    queryFn: () => api.fetchMySellerOrders(page, pageSize),
  });
}

export function useMySellerOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['seller-orders', id],
    queryFn: () => api.fetchMySellerOrder(id as string),
    enabled: Boolean(id),
  });
}

export function useUpdateMySellerOrderStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: SellerOrderStatus) => api.updateMySellerOrderStatus(id, status),
    onSuccess: (data) => {
      queryClient.setQueryData(['seller-orders', id], data);
      void queryClient.invalidateQueries({ queryKey: ['seller-orders', 'me'] });
    },
  });
}

export function useCancelMySellerOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelMySellerOrder(id),
    onSuccess: (data) => {
      queryClient.setQueryData(['seller-orders', id], data);
      void queryClient.invalidateQueries({ queryKey: ['seller-orders', 'me'] });
    },
  });
}
