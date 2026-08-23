import { useQuery } from '@tanstack/react-query';
import { fetchCatalog } from '../../api/products';
import type { CatalogQuery } from '../../types/catalog';

export function useCatalog(query: CatalogQuery) {
  return useQuery({
    queryKey: ['catalog', query],
    queryFn: () => fetchCatalog(query),
    placeholderData: (previous) => previous,
  });
}
