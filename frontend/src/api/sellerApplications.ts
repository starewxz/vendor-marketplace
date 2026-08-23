import { apiClient } from './client';
import type { SellerApplication, SellerApplicationStatus } from '../types/sellerApplication';

export interface ApplyForSellerInput {
  businessName: string;
  description: string;
}

export async function applyForSeller(input: ApplyForSellerInput): Promise<SellerApplication> {
  const { data } = await apiClient.post<SellerApplication>('/seller-applications', input);
  return data;
}

export async function fetchMyApplications(): Promise<SellerApplication[]> {
  const { data } = await apiClient.get<SellerApplication[]>('/seller-applications/me');
  return data;
}

export async function fetchAdminApplications(status?: SellerApplicationStatus): Promise<SellerApplication[]> {
  const { data } = await apiClient.get<SellerApplication[]>('/admin/seller-applications', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function approveApplication(id: string): Promise<SellerApplication> {
  const { data } = await apiClient.patch<SellerApplication>(`/admin/seller-applications/${id}/approve`);
  return data;
}

export async function rejectApplication(id: string, reason: string): Promise<SellerApplication> {
  const { data } = await apiClient.patch<SellerApplication>(`/admin/seller-applications/${id}/reject`, { reason });
  return data;
}
