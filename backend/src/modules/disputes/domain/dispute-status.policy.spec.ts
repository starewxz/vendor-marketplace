import { ConflictException } from '@nestjs/common';
import {
  assertDisputeTransition,
  isActiveDispute,
} from './dispute-status.policy';
import { DisputeStatus } from '../entities/dispute-status.enum';

describe('dispute status policy', () => {
  it('allows review and terminal resolution', () => {
    expect(() =>
      assertDisputeTransition(DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW),
    ).not.toThrow();
    expect(() =>
      assertDisputeTransition(
        DisputeStatus.UNDER_REVIEW,
        DisputeStatus.RESOLVED_CUSTOMER,
      ),
    ).not.toThrow();
  });
  it('rejects reopening a terminal dispute', () => {
    expect(() =>
      assertDisputeTransition(
        DisputeStatus.RESOLVED_SELLER,
        DisputeStatus.OPEN,
      ),
    ).toThrow(ConflictException);
  });
  it('identifies active states', () => {
    expect(isActiveDispute(DisputeStatus.OPEN)).toBe(true);
    expect(isActiveDispute(DisputeStatus.CLOSED)).toBe(false);
  });
});
