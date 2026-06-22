import { ItemType } from '../items/item.entity';
import { CostType } from '../process-costs/process-cost.entity';

export interface ProcessLine {
  label: string;
  costType: CostType;
  value: number;   // the configured value (amount or percent)
  amount: number;  // contribution to the batch total, in IDR
}

export interface CostBreakdown {
  materialCost: number;
  process: { fixedTotal: number; perUnitTotal: number; pctTotal: number; lines: ProcessLine[] };
  yieldQuantity: number;
  yieldUnit: string | null;
  totalBatchCost: number;
  components: CostNode[];
}

export interface CostNode {
  itemId: string;
  name: string;
  type: ItemType;
  baseUnit: string;
  unitCost: number;            // cost per 1 baseUnit
  quantity?: number;
  unit?: string;
  grossQuantity?: number;      // quantity / wasteFactor, in component baseUnit
  lineCost?: number;           // unitCost * grossQuantity
  breakdown?: CostBreakdown;   // present for PRODUCED items
}
