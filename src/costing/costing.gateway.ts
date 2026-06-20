import { ItemType } from '../items/item.entity';
import { CostType } from '../process-costs/process-cost.entity';

export interface ItemData {
  id: string;
  name: string;
  type: ItemType;
  baseUnit: string;
  yieldQuantity: string | null;
  yieldUnit: string | null;
}
export interface ComponentData {
  componentItemId: string;
  quantity: string;
  unit: string;
  wasteFactor: string;
}
export interface PriceData {
  price: string;
  purchaseQuantity: string;
  purchaseUnit: string;
}
export interface ProcessCostData { label: string; costType: CostType; value: string }

export interface PriceOverride {
  itemId: string;
  price: string;
  purchaseQuantity: string;
  purchaseUnit: string;
}

export interface CostingGateway {
  getItem(id: string): Promise<ItemData | null>;
  getComponents(parentId: string): Promise<ComponentData[]>;
  getLatestPrice(itemId: string): Promise<PriceData | null>;
  getProcessCosts(itemId: string): Promise<ProcessCostData[]>;
}

export const COSTING_GATEWAY = Symbol('COSTING_GATEWAY');

export class CircularReferenceError extends Error {
  constructor(itemId: string) {
    super(`Circular reference detected at item ${itemId}`);
    this.name = 'CircularReferenceError';
  }
}
export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item ${itemId} not found`);
    this.name = 'ItemNotFoundError';
  }
}
export class MissingPriceError extends Error {
  constructor(itemId: string) {
    super(`PURCHASED item ${itemId} has no purchase price`);
    this.name = 'MissingPriceError';
  }
}
