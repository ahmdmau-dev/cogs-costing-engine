import { D, round } from '../common/decimal.util';
import { UnitConverter } from '../units/unit-converter';
import { ItemType } from '../items/item.entity';
import { CostType } from '../process-costs/process-cost.entity';
import { CostNode, ProcessLine } from './cost-node.interface';
import {
  CostingGateway, PriceOverride, CircularReferenceError, ItemNotFoundError, MissingPriceError,
} from './costing.gateway';

export class CostingService {
  constructor(
    private readonly gateway: CostingGateway,
    private readonly converter: UnitConverter,
  ) {}

  async computeCost(
    itemId: string,
    opts: { pathSet?: Set<string>; priceOverride?: PriceOverride } = {},
  ): Promise<CostNode> {
    const pathSet = opts.pathSet ?? new Set<string>();
    const item = await this.gateway.getItem(itemId);
    if (!item) throw new ItemNotFoundError(itemId);

    if (item.type === ItemType.PURCHASED) {
      return this.computePurchased(item, opts.priceOverride);
    }

    if (pathSet.has(itemId)) throw new CircularReferenceError(itemId);
    const childPath = new Set(pathSet).add(itemId);
    return this.computeProduced(item, childPath, opts.priceOverride);
  }

  private async computePurchased(
    item: { id: string; name: string; baseUnit: string },
    override?: PriceOverride,
  ): Promise<CostNode> {
    const price =
      override && override.itemId === item.id
        ? { price: override.price, purchaseQuantity: override.purchaseQuantity, purchaseUnit: override.purchaseUnit }
        : await this.gateway.getLatestPrice(item.id);
    if (!price) throw new MissingPriceError(item.id);

    const factor = await this.converter.factor(price.purchaseUnit, item.baseUnit, item.id);
    const qtyInBase = D(price.purchaseQuantity).mul(factor);
    const unitCost = D(price.price).div(qtyInBase);
    return {
      itemId: item.id, name: item.name, type: ItemType.PURCHASED, baseUnit: item.baseUnit,
      unitCost: round(unitCost, 4),
    };
  }

  private async computeProduced(
    item: { id: string; name: string; baseUnit: string; yieldQuantity: string | null; yieldUnit: string | null },
    pathSet: Set<string>,
    override?: PriceOverride,
  ): Promise<CostNode> {
    const components = await this.gateway.getComponents(item.id);
    const childNodes: CostNode[] = [];
    let materialCost = D(0);

    for (const c of components) {
      const child = await this.computeCost(c.componentItemId, { pathSet, priceOverride: override });
      const convFactor = await this.converter.factor(c.unit, child.baseUnit, c.componentItemId);
      const qtyInBase = D(c.quantity).mul(convFactor);
      const grossQty = qtyInBase.div(D(c.wasteFactor));
      const lineCost = D(child.unitCost).mul(grossQty);
      materialCost = materialCost.plus(lineCost);
      childNodes.push({
        ...child,
        quantity: round(D(c.quantity), 4),
        unit: c.unit,
        grossQuantity: round(grossQty, 4),
        lineCost: round(lineCost, 4),
      });
    }

    const yieldQty = item.yieldQuantity ? D(item.yieldQuantity) : D(1);
    const processCosts = await this.gateway.getProcessCosts(item.id);

    let fixedTotal = D(0);
    let perUnitTotal = D(0);
    let pctSum = D(0);
    const lines: ProcessLine[] = [];

    for (const p of processCosts) {
      if (p.costType === CostType.FIXED) fixedTotal = fixedTotal.plus(D(p.value));
      else if (p.costType === CostType.PER_UNIT) perUnitTotal = perUnitTotal.plus(D(p.value).mul(yieldQty));
      else if (p.costType === CostType.PERCENTAGE) pctSum = pctSum.plus(D(p.value));
    }

    const base = materialCost.plus(fixedTotal).plus(perUnitTotal);
    const pctTotal = base.mul(pctSum).div(100);

    for (const p of processCosts) {
      let amount = D(0);
      if (p.costType === CostType.FIXED) amount = D(p.value);
      else if (p.costType === CostType.PER_UNIT) amount = D(p.value).mul(yieldQty);
      else amount = base.mul(D(p.value)).div(100);
      lines.push({ label: p.label, costType: p.costType, value: round(D(p.value), 4), amount: round(amount) });
    }

    const totalBatch = base.plus(pctTotal);
    const unitCost = totalBatch.div(yieldQty);

    return {
      itemId: item.id, name: item.name, type: ItemType.PRODUCED, baseUnit: item.baseUnit,
      unitCost: round(unitCost, 4),
      breakdown: {
        materialCost: round(materialCost),
        process: {
          fixedTotal: round(fixedTotal),
          perUnitTotal: round(perUnitTotal),
          pctTotal: round(pctTotal),
          lines,
        },
        yieldQuantity: yieldQty.toNumber(),
        yieldUnit: item.yieldUnit,
        totalBatchCost: round(totalBatch),
        components: childNodes,
      },
    };
  }
}
