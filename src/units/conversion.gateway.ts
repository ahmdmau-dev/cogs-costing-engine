export interface ConversionEdge {
  itemId: string | null; // null = global
  fromUnit: string;
  toUnit: string;
  factor: string; // 1 fromUnit = factor toUnit
}

export interface ConversionGateway {
  // All edges relevant to an item: its own + global. Order irrelevant.
  getEdges(itemId: string | null): Promise<ConversionEdge[]>;
}

export const CONVERSION_GATEWAY = Symbol('CONVERSION_GATEWAY');
