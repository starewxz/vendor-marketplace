import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/orders';

export function useMyOrders(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['orders', 'me', page, pageSize],
    queryFn: () => api.fetchMyOrders(page, pageSize),
  });
}

export function useMyOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => api.fetchMyOrder(id as string),
    enabled: Boolean(id),
  });
}
