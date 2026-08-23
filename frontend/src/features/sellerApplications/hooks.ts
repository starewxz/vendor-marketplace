import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/sellerApplications';
import type { SellerApplicationStatus } from '../../types/sellerApplication';

const MY_APPLICATIONS_KEY = ['seller-applications', 'me'];
const ADMIN_APPLICATIONS_KEY = ['seller-applications', 'admin'];

export function useMyApplications() {
  return useQuery({ queryKey: MY_APPLICATIONS_KEY, queryFn: api.fetchMyApplications });
}

export function useApplyForSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.applyForSeller,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_APPLICATIONS_KEY }),
  });
}

export function useAdminApplications(status?: SellerApplicationStatus) {
  return useQuery({
    queryKey: [...ADMIN_APPLICATIONS_KEY, status ?? 'ALL'],
    queryFn: () => api.fetchAdminApplications(status),
  });
}

export function useApproveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.approveApplication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_APPLICATIONS_KEY }),
  });
}

export function useRejectApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectApplication(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_APPLICATIONS_KEY }),
  });
}
