import { apiClient } from './client';
import type { AdminAnalytics, SellerAnalytics } from '../types/analytics';

export interface AnalyticsPeriodInput {
  from?: string;
  to?: string;
}

export const fetchSellerAnalytics = async (period: AnalyticsPeriodInput = {}) =>
  (await apiClient.get<SellerAnalytics>('/seller/analytics/overview', { params: period })).data;

export const fetchAdminAnalytics = async (period: AnalyticsPeriodInput = {}) =>
  (await apiClient.get<AdminAnalytics>('/admin/analytics', { params: period })).data;

async function downloadReport(
  path: string,
  extension: 'csv' | 'json',
  period: AnalyticsPeriodInput,
): Promise<void> {
  const response = await apiClient.get<Blob>(path, {
    params: period,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cargo-crew-report-${period.from ?? 'latest'}-${period.to ?? 'today'}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const downloadAnalyticsCsv = (period: AnalyticsPeriodInput = {}) =>
  downloadReport('/admin/analytics/export.csv', 'csv', period);

export const downloadAnalyticsJson = (period: AnalyticsPeriodInput = {}) =>
  downloadReport('/admin/analytics/export.json', 'json', period);
