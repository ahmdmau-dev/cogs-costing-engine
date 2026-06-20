import { CostingGateway, ItemData, ComponentData, PriceData, ProcessCostData } from '../../src/costing/costing.gateway';
import { ConversionEdge, ConversionGateway } from '../../src/units/conversion.gateway';

export interface World {
  items: Record<string, ItemData>;
  components: Record<string, ComponentData[]>;
  prices: Record<string, PriceData>;
  processCosts: Record<string, ProcessCostData[]>;
  edges: ConversionEdge[];
}

export function emptyWorld(): World {
  return { items: {}, components: {}, prices: {}, processCosts: {}, edges: [] };
}

export function costingGateway(w: World): CostingGateway {
  return {
    getItem: async (id) => w.items[id] ?? null,
    getComponents: async (id) => w.components[id] ?? [],
    getLatestPrice: async (id) => w.prices[id] ?? null,
    getProcessCosts: async (id) => w.processCosts[id] ?? [],
  };
}

export function conversionGateway(w: World): ConversionGateway {
  return {
    getEdges: async (itemId) => w.edges.filter((e) => e.itemId === null || e.itemId === itemId),
  };
}

export function purchased(w: World, id: string, baseUnit: string, price: string, qty: string, unit: string) {
  w.items[id] = { id, name: id, type: 'PURCHASED' as any, baseUnit, yieldQuantity: null, yieldUnit: null };
  w.prices[id] = { price, purchaseQuantity: qty, purchaseUnit: unit };
}
export function produced(w: World, id: string, baseUnit: string, yieldQuantity: string, yieldUnit: string) {
  w.items[id] = { id, name: id, type: 'PRODUCED' as any, baseUnit, yieldQuantity, yieldUnit };
  w.components[id] = w.components[id] ?? [];
  w.processCosts[id] = w.processCosts[id] ?? [];
}
export function component(w: World, parent: string, child: string, quantity: string, unit: string, wasteFactor = '1') {
  (w.components[parent] = w.components[parent] ?? []).push({ componentItemId: child, quantity, unit, wasteFactor });
}
export function globalEdge(w: World, fromUnit: string, toUnit: string, factor: string) {
  w.edges.push({ itemId: null, fromUnit, toUnit, factor });
}
export function itemEdge(w: World, itemId: string, fromUnit: string, toUnit: string, factor: string) {
  w.edges.push({ itemId, fromUnit, toUnit, factor });
}
