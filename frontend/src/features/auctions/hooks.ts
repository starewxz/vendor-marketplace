import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelAuction,
  checkoutAuction,
  createAuction,
  fetchAdminAuctions,
  fetchBidHistory,
  fetchProductAuction,
  fetchSellerAuctions,
  fetchWinnerState,
  placeBid,
  updateAuction,
} from '../../api/auctions';

export function useProductAuction(productId?: string) {
  return useQuery({
    queryKey: ['auction', 'product', productId],
    queryFn: () => fetchProductAuction(productId!),
    enabled: !!productId,
    refetchInterval: 5_000,
  });
}

export function useBidHistory(auctionId?: string) {
  return useQuery({
    queryKey: ['auction', auctionId, 'bids'],
    queryFn: () => fetchBidHistory(auctionId!),
    enabled: !!auctionId,
    refetchInterval: 5_000,
  });
}

export function useWinnerState(auctionId?: string, enabled = false) {
  return useQuery({
    queryKey: ['auction', auctionId, 'winner-state'],
    queryFn: () => fetchWinnerState(auctionId!),
    enabled: !!auctionId && enabled,
    refetchInterval: 5_000,
  });
}

export function usePlaceBid(auctionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, key }: { amount: string; key: string }) => placeBid(auctionId, amount, key),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['auction'] });
    },
  });
}

export function useAuctionCheckout(auctionId: string) {
  return useMutation({ mutationFn: (key: string) => checkoutAuction(auctionId, key) });
}

export function useSellerAuctions() {
  return useQuery({ queryKey: ['seller-auctions'], queryFn: fetchSellerAuctions });
}

export function useCreateAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createAuction,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['seller-auctions'] }),
  });
}

export function useUpdateAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAuction>[1] }) =>
      updateAuction(id, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['seller-auctions'] }),
  });
}

export function useCancelAuction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: cancelAuction,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['seller-auctions'] }),
  });
}

export function useAdminAuctions() {
  return useQuery({ queryKey: ['admin-auctions'], queryFn: fetchAdminAuctions });
}
