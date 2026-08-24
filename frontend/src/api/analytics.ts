import { apiClient } from './client';
import type { AdminAnalytics, SellerAnalytics } from '../types/analytics';
export const fetchSellerAnalytics = async () => (await apiClient.get<SellerAnalytics>('/seller/analytics/overview')).data;
export const fetchAdminAnalytics = async () => (await apiClient.get<AdminAnalytics>('/admin/analytics')).data;
export async function downloadAnalyticsCsv(): Promise<void> { const response = await apiClient.get<Blob>('/admin/analytics/export.csv', { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = 'marketplace-report.csv'; link.click(); URL.revokeObjectURL(url); }
export async function downloadAnalyticsJson(): Promise<void> { const response = await apiClient.get<Blob>('/admin/analytics/export.json', { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = 'marketplace-report.json'; link.click(); URL.revokeObjectURL(url); }
