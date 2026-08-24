import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/refunds';
import type { CreateRefundInput } from '../../api/refunds';

export function useCreateRefund(sellerOrderId: string, parentOrderId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, input }: { idempotencyKey: string; input: CreateRefundInput }) =>
      api.createRefund(sellerOrderId, idempotencyKey, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-seller-orders', sellerOrderId] });
      if (parentOrderId) void queryClient.invalidateQueries({ queryKey: ['admin-orders', parentOrderId] });
    },
  });
}
