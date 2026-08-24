import { apiClient } from './client';
import type { Dispute, DisputePage, DisputeStatus } from '../types/dispute';
export const fetchMyDisputes = async () => (await apiClient.get<DisputePage>('/disputes')).data;
export const createDispute = async (sellerOrderId: string, input: { reason: string; description: string }) => (await apiClient.post<Dispute>(`/seller-orders/${sellerOrderId}/disputes`, input)).data;
export const fetchSellerDisputes = async () => (await apiClient.get<DisputePage>('/seller/disputes')).data;
export const respondToDispute = async (id: string, response: string) => (await apiClient.patch<Dispute>(`/seller/disputes/${id}/response`, { response })).data;
export const fetchAdminDisputes = async (status?: DisputeStatus) => (await apiClient.get<DisputePage>('/admin/disputes', { params: status ? { status } : {} })).data;
export const updateDisputeStatus = async (id: string, status: DisputeStatus) => (await apiClient.patch<Dispute>(`/admin/disputes/${id}/status`, { status })).data;
export const resolveDispute = async (id: string, input: { outcome: 'CUSTOMER' | 'SELLER'; adminResolution: string; refund?: { sellerOrderItemId: string; quantity: number; reason?: string } }) => (await apiClient.post<Dispute>(`/admin/disputes/${id}/resolve`, input, { headers: { 'Idempotency-Key': crypto.randomUUID() } })).data;
