import { DecimalTransformer, decimalColumn } from './decimal.transformer';

describe('DecimalTransformer', () => {
  const t = new DecimalTransformer();

  it('to(): converts number and string to a numeric string', () => {
    expect(t.to(12.5)).toBe('12.5');
    expect(t.to('1000.0001')).toBe('1000.0001');
  });

  it('to(): null and undefined become null', () => {
    expect(t.to(null)).toBeNull();
    expect(t.to(undefined as any)).toBeNull();
  });

  it('from(): returns the DB string unchanged (preserves precision, no float parse)', () => {
    expect(t.from('1000.0001')).toBe('1000.0001');
    expect(t.from('99999999999999.9999')).toBe('99999999999999.9999');
  });

  it('from(): passes null through', () => {
    expect(t.from(null)).toBeNull();
  });

  it('decimalColumn is a DecimalTransformer instance', () => {
    expect(decimalColumn).toBeInstanceOf(DecimalTransformer);
  });
});
