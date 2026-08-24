import { SellerOrderStatus } from '../entities/seller-order-status.enum';
import {
  deriveOrderFinancialSummary,
  deriveSellerOrderFinancialSummary,
} from './financial-summary';

describe('deriveSellerOrderFinancialSummary', () => {
  const sellerOrder = {
    status: SellerOrderStatus.DELIVERED,
    subtotal: '200.00',
    commissionAmount: '20.00',
    sellerNetAmount: '180.00',
  };

  it('with no refunds, effective equals original', () => {
    const summary = deriveSellerOrderFinancialSummary(sellerOrder, []);
    expect(summary.effectiveSubtotal).toBe('200.00');
    expect(summary.effectiveCommission).toBe('20.00');
    expect(summary.effectiveSellerNet).toBe('180.00');
    expect(summary.refundedAmount).toBe('0.00');
  });

  it('a partial refund reduces effective totals by exactly the refunded amounts', () => {
    const summary = deriveSellerOrderFinancialSummary(sellerOrder, [
      {
        amount: '100.00',
        commissionAdjustment: '10.00',
        sellerAdjustment: '90.00',
      },
    ]);
    expect(summary.refundedAmount).toBe('100.00');
    expect(summary.commissionReversed).toBe('10.00');
    expect(summary.sellerNetReversed).toBe('90.00');
    expect(summary.effectiveSubtotal).toBe('100.00');
    expect(summary.effectiveCommission).toBe('10.00');
    expect(summary.effectiveSellerNet).toBe('90.00');
  });

  it('multiple refunds sum their corrections', () => {
    const summary = deriveSellerOrderFinancialSummary(sellerOrder, [
      {
        amount: '50.00',
        commissionAdjustment: '5.00',
        sellerAdjustment: '45.00',
      },
      {
        amount: '50.00',
        commissionAdjustment: '5.00',
        sellerAdjustment: '45.00',
      },
    ]);
    expect(summary.effectiveSubtotal).toBe('100.00');
    expect(summary.effectiveCommission).toBe('10.00');
    expect(summary.effectiveSellerNet).toBe('90.00');
  });

  it('a CANCELLED seller order is a full reversal, independent of any Refund rows', () => {
    const summary = deriveSellerOrderFinancialSummary(
      { ...sellerOrder, status: SellerOrderStatus.CANCELLED },
      [],
    );
    expect(summary.refundedAmount).toBe('200.00');
    expect(summary.commissionReversed).toBe('20.00');
    expect(summary.sellerNetReversed).toBe('180.00');
    expect(summary.effectiveSubtotal).toBe('0.00');
    expect(summary.effectiveCommission).toBe('0.00');
    expect(summary.effectiveSellerNet).toBe('0.00');
  });

  it('originals are always preserved verbatim, regardless of refunds', () => {
    const summary = deriveSellerOrderFinancialSummary(sellerOrder, [
      {
        amount: '200.00',
        commissionAdjustment: '20.00',
        sellerAdjustment: '180.00',
      },
    ]);
    expect(summary.originalSubtotal).toBe('200.00');
    expect(summary.originalCommission).toBe('20.00');
    expect(summary.originalSellerNet).toBe('180.00');
  });
});

describe('deriveOrderFinancialSummary', () => {
  it('sums refundedAmount across seller orders and subtracts from the original total', () => {
    const summary = deriveOrderFinancialSummary('250.00', [
      {
        originalSubtotal: '200.00',
        originalCommission: '20.00',
        originalSellerNet: '180.00',
        refundedAmount: '100.00',
        commissionReversed: '10.00',
        sellerNetReversed: '90.00',
        effectiveSubtotal: '100.00',
        effectiveCommission: '10.00',
        effectiveSellerNet: '90.00',
      },
      {
        originalSubtotal: '50.00',
        originalCommission: '5.00',
        originalSellerNet: '45.00',
        refundedAmount: '0.00',
        commissionReversed: '0.00',
        sellerNetReversed: '0.00',
        effectiveSubtotal: '50.00',
        effectiveCommission: '5.00',
        effectiveSellerNet: '45.00',
      },
    ]);

    expect(summary.originalTotal).toBe('250.00');
    expect(summary.refundedTotal).toBe('100.00');
    expect(summary.effectiveTotal).toBe('150.00');
  });

  it('no refunds anywhere -> effectiveTotal equals originalTotal', () => {
    const summary = deriveOrderFinancialSummary('50.00', [
      {
        originalSubtotal: '50.00',
        originalCommission: '5.00',
        originalSellerNet: '45.00',
        refundedAmount: '0.00',
        commissionReversed: '0.00',
        sellerNetReversed: '0.00',
        effectiveSubtotal: '50.00',
        effectiveCommission: '5.00',
        effectiveSellerNet: '45.00',
      },
    ]);
    expect(summary.effectiveTotal).toBe('50.00');
  });
});
