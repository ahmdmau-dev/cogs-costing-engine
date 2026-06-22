import { D, round } from './decimal.util';

describe('decimal.util', () => {
  it('D parses string and number', () => {
    expect(D('12.5').plus(D(2)).toString()).toBe('14.5');
  });
  it('round returns a number with given dp (default 2)', () => {
    expect(round(D('12.005'))).toBe(12.01);
    expect(round(D('12.0049'), 2)).toBe(12.0);
    expect(round(D('1.23456'), 4)).toBe(1.2346);
  });
});
