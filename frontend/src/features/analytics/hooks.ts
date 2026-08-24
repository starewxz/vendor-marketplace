import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/analytics';
import type { AnalyticsPeriodInput } from '../../api/analytics';

export const useSellerAnalytics = (period: AnalyticsPeriodInput = {}) =>
  useQuery({
    queryKey: ['analytics', 'seller', period],
    queryFn: () => api.fetchSellerAnalytics(period),
  });

export const useAdminAnalytics = (period: AnalyticsPeriodInput = {}) =>
  useQuery({
    queryKey: ['analytics', 'admin', period],
    queryFn: () => api.fetchAdminAnalytics(period),
  });
