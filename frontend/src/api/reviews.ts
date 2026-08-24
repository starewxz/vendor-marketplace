import { apiClient } from './client';
import type { Review, ReviewEligibility, ReviewPage } from '../types/review';
export const fetchReviews = async (productId: string) => (await apiClient.get<ReviewPage>(`/products/${productId}/reviews`)).data;
export const fetchReviewEligibility = async (productId: string) => (await apiClient.get<ReviewEligibility>(`/products/${productId}/review-eligibility`)).data;
export const createReview = async (productId: string, input: { sellerOrderItemId: string; rating: number; comment?: string }) => (await apiClient.post<Review>(`/products/${productId}/reviews`, input)).data;
export const updateReview = async (id: string, input: { rating?: number; comment?: string }) => (await apiClient.patch<Review>(`/reviews/${id}`, input)).data;
export const deleteReview = async (id: string) => { await apiClient.delete(`/reviews/${id}`); };
