import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/analytics';
export const useSellerAnalytics = () => useQuery({ queryKey: ['analytics', 'seller'], queryFn: api.fetchSellerAnalytics });
export const useAdminAnalytics = () => useQuery({ queryKey: ['analytics', 'admin'], queryFn: api.fetchAdminAnalytics });
