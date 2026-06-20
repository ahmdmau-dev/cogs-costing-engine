import { CostingService } from '../../src/costing/costing.service';
import { UnitConverter } from '../../src/units/unit-converter';
import { CircularReferenceError } from '../../src/costing/costing.gateway';
import {
  World, emptyWorld, costingGateway, conversionGateway,
  purchased, produced, component, globalEdge, itemEdge,
} from './fixtures';

function engine(w: World): CostingService {
  return new CostingService(costingGateway(w), new UnitConverter(conversionGateway(w)));
}

describe('CostingService', () => {
  it('1. simple purchased item: price normalized to base unit', async () => {
    const w = emptyWorld();
    globalEdge(w, 'kg', 'g', '1000');
    purchased(w, 'flour', 'g', '12000', '1', 'kg');
    const node = await engine(w).computeCost('flour');
    expect(node.unitCost).toBe(12);
  });

  it('2. single-level recipe rolls up component costs', async () => {
    const w = emptyWorld();
    globalEdge(w, 'kg', 'g', '1000');
    purchased(w, 'flour', 'g', '12000', '1', 'kg');
    purchased(w, 'sugar', 'g', '15000', '1', 'kg');
    produced(w, 'dough', 'g', '1000', 'g');
    component(w, 'dough', 'flour', '600', 'g');
    component(w, 'dough', 'sugar', '100', 'g');
    const node = await engine(w).computeCost('dough');
    expect(node.breakdown!.materialCost).toBe(8700);
    expect(node.unitCost).toBe(8.7);
  });

  it('3. multi-level recipe reuses a semi-finished good', async () => {
    const w = emptyWorld();
    globalEdge(w, 'kg', 'g', '1000');
    purchased(w, 'flour', 'g', '10000', '1', 'kg');
    produced(w, 'dough', 'g', '1000', 'g');
    component(w, 'dough', 'flour', '500', 'g');
    produced(w, 'donut', 'pcs', '10', 'pcs');
    component(w, 'donut', 'dough', '200', 'g');
    const node = await engine(w).computeCost('donut');
    expect(node.breakdown!.materialCost).toBe(1000);
    expect(node.unitCost).toBe(100);
  });

  it('4. per-item unit conversion (1 ekor = 1000 g)', async () => {
    const w = emptyWorld();
    purchased(w, 'chicken', 'g', '50000', '1', 'ekor');
    itemEdge(w, 'chicken', 'ekor', 'g', '1000');
    const node = await engine(w).computeCost('chicken');
    expect(node.unitCost).toBe(50);
  });

  it('5. component waste factor raises effective cost', async () => {
    const w = emptyWorld();
    purchased(w, 'chicken', 'g', '50', '1', 'g');
    produced(w, 'dish', 'porsi', '1', 'porsi');
    component(w, 'dish', 'chicken', '800', 'g', '0.8');
    const node = await engine(w).computeCost('dish');
    const line = node.breakdown!.components[0];
    expect(line.grossQuantity).toBe(1000);
    expect(line.lineCost).toBe(50000);
    expect(node.unitCost).toBe(50000);
  });

  it('6. output yield divides batch cost', async () => {
    const w = emptyWorld();
    purchased(w, 'flour', 'g', '10', '1', 'g');
    produced(w, 'cookies', 'pcs', '24', 'pcs');
    component(w, 'cookies', 'flour', '480', 'g');
    const node = await engine(w).computeCost('cookies');
    expect(node.breakdown!.totalBatchCost).toBe(4800);
    expect(node.unitCost).toBe(200);
  });

  it('7. PERCENTAGE process cost applies to material+fixed+per-unit base, order-independent', async () => {
    const w = emptyWorld();
    purchased(w, 'flour', 'g', '10', '1', 'g');
    produced(w, 'cake', 'pcs', '1', 'pcs');
    component(w, 'cake', 'flour', '100', 'g');
    w.processCosts['cake'] = [
      { label: 'labor', costType: 'FIXED' as any, value: '500' },
      { label: 'packaging', costType: 'PER_UNIT' as any, value: '200' },
      { label: 'overhead', costType: 'PERCENTAGE' as any, value: '10' },
      { label: 'profit-buffer', costType: 'PERCENTAGE' as any, value: '5' },
    ];
    const node = await engine(w).computeCost('cake');
    expect(node.breakdown!.process.fixedTotal).toBe(500);
    expect(node.breakdown!.process.perUnitTotal).toBe(200);
    expect(node.breakdown!.process.pctTotal).toBe(255);
    expect(node.breakdown!.totalBatchCost).toBe(1955);
    expect(node.unitCost).toBe(1955);
  });

  it('8. rejects a circular reference', async () => {
    const w = emptyWorld();
    produced(w, 'a', 'g', '1', 'g');
    produced(w, 'b', 'g', '1', 'g');
    component(w, 'a', 'b', '1', 'g');
    component(w, 'b', 'a', '1', 'g');
    await expect(engine(w).computeCost('a')).rejects.toBeInstanceOf(CircularReferenceError);
  });
});
