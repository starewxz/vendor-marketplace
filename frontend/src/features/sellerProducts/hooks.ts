import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/sellerProducts';
import type { ProductFormInput } from '../../types/product';

const MY_PRODUCTS_KEY = ['seller-products', 'me'];

export function useMyProducts() {
  return useQuery({ queryKey: MY_PRODUCTS_KEY, queryFn: api.fetchMyProducts });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PRODUCTS_KEY }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProductFormInput> }) => api.updateProduct(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PRODUCTS_KEY }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PRODUCTS_KEY }),
  });
}
