import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/sellerOrders';

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
