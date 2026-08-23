export type SellerApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SellerApplication {
  id: string;
  userId: string;
  requestedStoreName: string;
  businessDescription: string;
  status: SellerApplicationStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
