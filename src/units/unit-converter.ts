import { D, Decimal } from '../common/decimal.util';
import { ConversionEdge, ConversionGateway } from './conversion.gateway';

interface Edge { to: string; factor: Decimal; itemScoped: boolean }

export class UnitConverter {
  constructor(private readonly gateway: ConversionGateway) {}

  async factor(fromUnit: string, toUnit: string, itemId: string | null): Promise<Decimal> {
    if (fromUnit === toUnit) return D(1);

    const edges = await this.gateway.getEdges(itemId);
    const adj = this.buildAdjacency(edges, itemId);

    // BFS carrying the accumulated factor; per-item edges already prioritized in adjacency.
    const queue: Array<{ unit: string; factor: Decimal }> = [{ unit: fromUnit, factor: D(1) }];
    const seen = new Set<string>([fromUnit]);

    while (queue.length) {
      const { unit, factor } = queue.shift()!;
      for (const e of adj.get(unit) ?? []) {
        if (e.to === toUnit) return factor.mul(e.factor);
        if (!seen.has(e.to)) {
          seen.add(e.to);
          queue.push({ unit: e.to, factor: factor.mul(e.factor) });
        }
      }
    }
    throw new Error(`No conversion path from "${fromUnit}" to "${toUnit}" (item: ${itemId ?? 'global'})`);
  }

  private buildAdjacency(edges: ConversionEdge[], itemId: string | null): Map<string, Edge[]> {
    const adj = new Map<string, Edge[]>();
    const push = (from: string, to: string, factor: Decimal, itemScoped: boolean) => {
      const list = adj.get(from) ?? [];
      // Per-item edges go to the front so BFS reaches them first.
      if (itemScoped) list.unshift({ to, factor, itemScoped });
      else list.push({ to, factor, itemScoped });
      adj.set(from, list);
    };
    for (const e of edges) {
      const scoped = e.itemId !== null && e.itemId === itemId;
      const f = D(e.factor);
      push(e.fromUnit, e.toUnit, f, scoped);
      push(e.toUnit, e.fromUnit, D(1).div(f), scoped); // implicit inverse
    }
    return adj;
  }
}
