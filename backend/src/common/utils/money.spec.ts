import {
  applyPercent,
  applyRatio,
  formatCentsToMoney,
  multiplyCentsByQuantity,
  parseMoneyToCents,
  sumCents,
} from './money';

describe('money', () => {
  describe('parseMoneyToCents / formatCentsToMoney round-trip', () => {
    it.each(['79.99', '0.00', '10', '1000.50', '0.01'])(
      'round-trips %s',
      (value) => {
        expect(formatCentsToMoney(parseMoneyToCents(value))).toBe(
          value.includes('.') ? value : `${value}.00`,
        );
      },
    );

    it('rejects more than 2 decimal places', () => {
      expect(() => parseMoneyToCents('1.999')).toThrow();
    });
  });

  describe('multiplyCentsByQuantity', () => {
    it('multiplies unit price by quantity', () => {
      expect(
        formatCentsToMoney(
          multiplyCentsByQuantity(parseMoneyToCents('19.99'), 3),
        ),
      ).toBe('59.97');
    });
  });

  describe('sumCents', () => {
    it('sums multiple line totals', () => {
      const total = sumCents([
        parseMoneyToCents('10.00'),
        parseMoneyToCents('25.50'),
        parseMoneyToCents('0.49'),
      ]);
      expect(formatCentsToMoney(total)).toBe('35.99');
    });
  });

  describe('applyPercent (commission calculation)', () => {
    it('computes a simple 10% commission', () => {
      expect(
        formatCentsToMoney(applyPercent(parseMoneyToCents('100.00'), '10.00')),
      ).toBe('10.00');
    });

    it('rounds half-up deterministically on an odd cent split', () => {
      // 10% of 0.05 = 0.005 -> rounds up to 0.01
      expect(
        formatCentsToMoney(applyPercent(parseMoneyToCents('0.05'), '10.00')),
      ).toBe('0.01');
      // 10% of 0.03 = 0.003 -> rounds down to 0.00
      expect(
        formatCentsToMoney(applyPercent(parseMoneyToCents('0.03'), '10.00')),
      ).toBe('0.00');
    });

    it('supports non-integer commission rates', () => {
      expect(
        formatCentsToMoney(applyPercent(parseMoneyToCents('200.00'), '7.50')),
      ).toBe('15.00');
    });

    it('seller net amount is subtotal minus commission, cents-exact', () => {
      const subtotal = parseMoneyToCents('129.99');
      const commission = applyPercent(subtotal, '10.00');
      const net = subtotal - commission;
      expect(formatCentsToMoney(commission)).toBe('13.00');
      expect(formatCentsToMoney(net)).toBe('116.99');
    });
  });

  describe('applyRatio (refund commission correction)', () => {
    it('carries the stored subtotal/commission ratio forward onto a partial amount', () => {
      // SellerOrder: subtotal 200.00, commission 20.00 (10% effective rate).
      // Refunding a 100.00 gross portion should correct commission by 10.00.
      const refundGross = parseMoneyToCents('100.00');
      const commission = parseMoneyToCents('20.00');
      const subtotal = parseMoneyToCents('200.00');
      expect(
        formatCentsToMoney(applyRatio(refundGross, commission, subtotal)),
      ).toBe('10.00');
    });

    it('matches the worked example from the spec (100 gross, 10% effective rate)', () => {
      // subtotal 200 -> commission 20 (10%); refund 1 of 2 units -> gross 100.
      const commissionCorrection = applyRatio(
        parseMoneyToCents('100.00'),
        parseMoneyToCents('20.00'),
        parseMoneyToCents('200.00'),
      );
      const sellerCorrection =
        parseMoneyToCents('100.00') - commissionCorrection;
      expect(formatCentsToMoney(commissionCorrection)).toBe('10.00');
      expect(formatCentsToMoney(sellerCorrection)).toBe('90.00');
    });

    it('still reconciles exactly when refunding the full amount across multiple calls', () => {
      // Two refunds of 100.00 each against a 200.00/20.00 seller order should
      // sum to exactly the original commission — no rounding drift.
      const perRefund = applyRatio(
        parseMoneyToCents('100.00'),
        parseMoneyToCents('20.00'),
        parseMoneyToCents('200.00'),
      );
      expect(formatCentsToMoney(perRefund * 2n)).toBe('20.00');
    });

    it('rounds half-up on an uneven split', () => {
      // 7.50% effective rate (commission 7.50 on subtotal 100.00); refund a
      // 33.33 gross portion -> 33.33 * 7.50 / 100.00 = 2.49975 -> rounds to 2.50.
      const result = applyRatio(
        parseMoneyToCents('33.33'),
        parseMoneyToCents('7.50'),
        parseMoneyToCents('100.00'),
      );
      expect(formatCentsToMoney(result)).toBe('2.50');
    });

    it('returns 0 rather than dividing by zero when the denominator is 0', () => {
      expect(
        formatCentsToMoney(
          applyRatio(parseMoneyToCents('10.00'), parseMoneyToCents('1.00'), 0n),
        ),
      ).toBe('0.00');
    });
  });
});
