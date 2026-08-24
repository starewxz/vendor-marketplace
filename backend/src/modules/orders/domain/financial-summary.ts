import { SellerOrderStatus } from '../entities/seller-order-status.enum';
import {
  formatCentsToMoney,
  parseMoneyToCents,
  sumCents,
} from '../../../common/utils/money';

export interface SellerOrderFinancialSummary {
  originalSubtotal: string;
  originalCommission: string;
  originalSellerNet: string;
  refundedAmount: string;
  commissionReversed: string;
  sellerNetReversed: string;
  effectiveSubtotal: string;
  effectiveCommission: string;
  effectiveSellerNet: string;
}

export interface RefundLikeAdjustment {
  amount: string;
  commissionAdjustment: string;
  sellerAdjustment: string;
}

/**
 * Pure, derived from the SellerOrder's immutable original figures plus its
 * COMPLETED refunds — never stored, so there's exactly one source of truth
 * (see README "Financial correction model" / spec section 18's warning
 * against contradictory sources of truth).
 *
 * A CANCELLED SellerOrder is a full reversal by definition (see
 * SellerOrderLifecycleService.cancel — it never creates a Refund row, it
 * reverses via ledger entries directly), so it's handled as a special case
 * here rather than requiring a synthetic "refund everything" Refund row.
 */
export function deriveSellerOrderFinancialSummary(
  sellerOrder: {
    status: SellerOrderStatus;
    subtotal: string;
    commissionAmount: string;
    sellerNetAmount: string;
  },
  completedRefunds: RefundLikeAdjustment[],
): SellerOrderFinancialSummary {
  const originalSubtotalCents = parseMoneyToCents(sellerOrder.subtotal);
  const originalCommissionCents = parseMoneyToCents(
    sellerOrder.commissionAmount,
  );
  const originalSellerNetCents = parseMoneyToCents(sellerOrder.sellerNetAmount);

  if (sellerOrder.status === SellerOrderStatus.CANCELLED) {
    return {
      originalSubtotal: sellerOrder.subtotal,
      originalCommission: sellerOrder.commissionAmount,
      originalSellerNet: sellerOrder.sellerNetAmount,
      refundedAmount: sellerOrder.subtotal,
      commissionReversed: sellerOrder.commissionAmount,
      sellerNetReversed: sellerOrder.sellerNetAmount,
      effectiveSubtotal: '0.00',
      effectiveCommission: '0.00',
      effectiveSellerNet: '0.00',
    };
  }

  const refundedAmountCents = sumCents(
    completedRefunds.map((r) => parseMoneyToCents(r.amount)),
  );
  const commissionReversedCents = sumCents(
    completedRefunds.map((r) => parseMoneyToCents(r.commissionAdjustment)),
  );
  const sellerNetReversedCents = sumCents(
    completedRefunds.map((r) => parseMoneyToCents(r.sellerAdjustment)),
  );

  return {
    originalSubtotal: sellerOrder.subtotal,
    originalCommission: sellerOrder.commissionAmount,
    originalSellerNet: sellerOrder.sellerNetAmount,
    refundedAmount: formatCentsToMoney(refundedAmountCents),
    commissionReversed: formatCentsToMoney(commissionReversedCents),
    sellerNetReversed: formatCentsToMoney(sellerNetReversedCents),
    effectiveSubtotal: formatCentsToMoney(
      originalSubtotalCents - refundedAmountCents,
    ),
    effectiveCommission: formatCentsToMoney(
      originalCommissionCents - commissionReversedCents,
    ),
    effectiveSellerNet: formatCentsToMoney(
      originalSellerNetCents - sellerNetReversedCents,
    ),
  };
}

export interface OrderFinancialSummary {
  originalTotal: string;
  refundedTotal: string;
  effectiveTotal: string;
}

export function deriveOrderFinancialSummary(
  originalTotal: string,
  sellerOrderSummaries: SellerOrderFinancialSummary[],
): OrderFinancialSummary {
  const refundedTotalCents = sumCents(
    sellerOrderSummaries.map((s) => parseMoneyToCents(s.refundedAmount)),
  );
  const originalTotalCents = parseMoneyToCents(originalTotal);
  return {
    originalTotal,
    refundedTotal: formatCentsToMoney(refundedTotalCents),
    effectiveTotal: formatCentsToMoney(originalTotalCents - refundedTotalCents),
  };
}
