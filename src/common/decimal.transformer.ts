import { ValueTransformer } from 'typeorm';

// Stores numbers as numeric strings, reads them back as strings (engine wraps in Decimal).
export class DecimalTransformer implements ValueTransformer {
  to(value: number | string | null): string | null {
    return value === null || value === undefined ? null : value.toString();
  }
  from(value: string | null): string | null {
    return value;
  }
}
export const decimalColumn = new DecimalTransformer();
