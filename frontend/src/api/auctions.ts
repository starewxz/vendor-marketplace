import { apiClient } from './client';
import type {
  AuctionCheckoutResult,
  AuctionInput,
  AuctionView,
  AuctionWinnerState,
  BidAccepted,
  BidHistoryItem,
  PaginatedAuctions,
  SellerAuction,
} from '../types/auction';

export async function fetchProductAuction(productId: string) {
  return (await apiClient.get<AuctionView>(`/products/${productId}/auction`)).data;
}

export async function fetchBidHistory(auctionId: string) {
  return (await apiClient.get<BidHistoryItem[]>(`/auctions/${auctionId}/bids`)).data;
}

export async function fetchWinnerState(auctionId: string) {
  return (await apiClient.get<AuctionWinnerState>(`/auctions/${auctionId}/winner-state`)).data;
}

export async function placeBid(auctionId: string, amount: string, idempotencyKey: string) {
  return (
    await apiClient.post<BidAccepted>(
      `/auctions/${auctionId}/bids`,
      { amount },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data;
}

export async function checkoutAuction(auctionId: string, idempotencyKey: string) {
  return (
    await apiClient.post<AuctionCheckoutResult>(
      `/auctions/${auctionId}/checkout`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data;
}

export async function fetchSellerAuctions() {
  return (await apiClient.get<SellerAuction[]>('/seller/auctions')).data;
}

export async function fetchSellerAuction(id: string) {
  return (await apiClient.get<SellerAuction>(`/seller/auctions/${id}`)).data;
}

export async function createAuction(input: AuctionInput) {
  return (await apiClient.post<SellerAuction>('/seller/auctions', input)).data;
}

export async function updateAuction(id: string, input: Partial<Omit<AuctionInput, 'productId'>>) {
  return (await apiClient.patch<SellerAuction>(`/seller/auctions/${id}`, input)).data;
}

export async function cancelAuction(id: string) {
  return (await apiClient.post<SellerAuction>(`/seller/auctions/${id}/cancel`)).data;
}

export async function fetchAdminAuctions() {
  return (await apiClient.get<PaginatedAuctions>('/admin/auctions')).data;
}

export async function fetchAdminAuction(id: string) {
  return (await apiClient.get<SellerAuction>(`/admin/auctions/${id}`)).data;
}

export async function cancelAdminAuction(id: string) {
  return (await apiClient.post<SellerAuction>(`/admin/auctions/${id}/cancel`)).data;
}
