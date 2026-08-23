import { useQuery } from '@tanstack/react-query';
import { fetchProductById } from '../../api/products';

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => fetchProductById(id as string),
    enabled: Boolean(id),
  });
}
