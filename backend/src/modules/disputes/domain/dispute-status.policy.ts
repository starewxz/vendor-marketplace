import { ConflictException } from '@nestjs/common';
import { DisputeStatus } from '../entities/dispute-status.enum';

const ALLOWED: Record<DisputeStatus, readonly DisputeStatus[]> = {
  [DisputeStatus.OPEN]: [
    DisputeStatus.UNDER_REVIEW,
    DisputeStatus.RESOLVED_CUSTOMER,
    DisputeStatus.RESOLVED_SELLER,
    DisputeStatus.CLOSED,
  ],
  [DisputeStatus.UNDER_REVIEW]: [
    DisputeStatus.RESOLVED_CUSTOMER,
    DisputeStatus.RESOLVED_SELLER,
    DisputeStatus.CLOSED,
  ],
  [DisputeStatus.RESOLVED_CUSTOMER]: [DisputeStatus.CLOSED],
  [DisputeStatus.RESOLVED_SELLER]: [DisputeStatus.CLOSED],
  [DisputeStatus.CLOSED]: [],
};

export function assertDisputeTransition(
  from: DisputeStatus,
  to: DisputeStatus,
): void {
  if (from === to) return;
  if (!ALLOWED[from].includes(to))
    throw new ConflictException(`Invalid dispute transition: ${from} -> ${to}`);
}

export function isActiveDispute(status: DisputeStatus): boolean {
  return status === DisputeStatus.OPEN || status === DisputeStatus.UNDER_REVIEW;
}
