import { percentageChange, protectCsvValue } from './analytics.service';

describe('analytics calculations', () => {
  it('calculates comparison and handles zero safely', () => {
    expect(percentageChange(120, 100)).toBe(20);
    expect(percentageChange(0, 0)).toBe(0);
    expect(percentageChange(10, 0)).toBeNull();
  });
  it.each(['=SUM(A1:A2)', '+cmd', '-10', '@name'])(
    'neutralizes CSV formula input %s',
    (value) => {
      expect(protectCsvValue(value)).toBe(`"'${value}"`);
    },
  );
  it('escapes quotes', () =>
    expect(protectCsvValue('Cargo "Crew"')).toBe('"Cargo ""Crew"""'));
});
