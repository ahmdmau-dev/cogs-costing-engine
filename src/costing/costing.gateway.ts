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

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from '../items/item.entity';
import { ItemComponent } from '../components/item-component.entity';
import { PurchasePrice } from '../pricing/purchase-price.entity';
import { ProcessCost } from '../process-costs/process-cost.entity';

@Injectable()
export class TypeOrmCostingGateway implements CostingGateway {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(ItemComponent) private readonly components: Repository<ItemComponent>,
    @InjectRepository(PurchasePrice) private readonly prices: Repository<PurchasePrice>,
    @InjectRepository(ProcessCost) private readonly processCosts: Repository<ProcessCost>,
  ) {}

  async getItem(id: string): Promise<ItemData | null> {
    const i = await this.items.findOne({ where: { id } });
    return i ? { id: i.id, name: i.name, type: i.type, baseUnit: i.baseUnit, yieldQuantity: i.yieldQuantity, yieldUnit: i.yieldUnit } : null;
  }
  async getComponents(parentId: string): Promise<ComponentData[]> {
    const rows = await this.components.find({ where: { parentItemId: parentId } });
    return rows.map((r) => ({ componentItemId: r.componentItemId, quantity: r.quantity, unit: r.unit, wasteFactor: r.wasteFactor }));
  }
  async getLatestPrice(itemId: string): Promise<PriceData | null> {
    const p = await this.prices.findOne({ where: { itemId }, order: { effectiveDate: 'DESC', createdAt: 'DESC' } });
    return p ? { price: p.price, purchaseQuantity: p.purchaseQuantity, purchaseUnit: p.purchaseUnit } : null;
  }
  async getProcessCosts(itemId: string): Promise<ProcessCostData[]> {
    const rows = await this.processCosts.find({ where: { itemId } });
    return rows.map((r) => ({ label: r.label, costType: r.costType, value: r.value }));
  }
}
