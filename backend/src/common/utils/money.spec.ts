import {
  applyPercent,
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
});
