import { useQuery } from '@tanstack/react-query';
import { fetchPublishedProducts } from '../../api/products';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchPublishedProducts,
  });
}
