import Decimal from 'decimal.js';

export { Decimal };
export const D = (v: Decimal.Value): Decimal => new Decimal(v);

export function round(value: Decimal, dp = 2): number {
  return value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toNumber();
}
