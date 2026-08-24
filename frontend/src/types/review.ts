export interface Review { id: string; productId: string; sellerOrderItemId: string; rating: number; comment: string | null; customerDisplayName: string; isMine: boolean; createdAt: string; updatedAt: string }
export interface ReviewEligibility { eligible: boolean; sellerOrderItemId: string | null; existingReview: Review | null; reason?: string }
export interface ReviewPage { data: Review[]; meta: { page: number; pageSize: number; total: number } }
