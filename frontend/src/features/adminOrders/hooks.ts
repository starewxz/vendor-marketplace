import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/adminOrders';

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
