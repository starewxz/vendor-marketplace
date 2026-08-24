import { apiClient } from './client';
import type { RefundView } from '../types/order';

export interface CreateRefundInput {
  sellerOrderItemId: string;
  quantity: number;
  reason?: string;
}

export async function createRefund(
  sellerOrderId: string,
  idempotencyKey: string,
  input: CreateRefundInput,
): Promise<RefundView> {
  const { data } = await apiClient.post<RefundView>(
    `/admin/seller-orders/${sellerOrderId}/refunds`,
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return data;
}

export async function fetchRefunds(sellerOrderId: string): Promise<RefundView[]> {
  const { data } = await apiClient.get<RefundView[]>(`/admin/seller-orders/${sellerOrderId}/refunds`);
  return data;
}
