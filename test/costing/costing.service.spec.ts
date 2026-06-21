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

  it('9. diamond dependency (shared component, not a cycle) computes without error', async () => {
    const w = emptyWorld();
    purchased(w, 'flour', 'g', '10', '1', 'g'); // 10/g
    // two intermediate produced items both using flour
    produced(w, 'doughA', 'g', '1', 'g');
    component(w, 'doughA', 'flour', '1', 'g');   // 10/g
    produced(w, 'doughB', 'g', '1', 'g');
    component(w, 'doughB', 'flour', '2', 'g');   // 20/g
    // top item uses BOTH (flour is reached via two branches: a diamond, not a cycle)
    produced(w, 'pastry', 'pcs', '1', 'pcs');
    component(w, 'pastry', 'doughA', '1', 'g');  // 10
    component(w, 'pastry', 'doughB', '1', 'g');  // 20
    const node = await engine(w).computeCost('pastry');
    expect(node.breakdown!.materialCost).toBe(30);
    expect(node.unitCost).toBe(30);
  });

  it('10. multi-level precision: no rounding drift through intermediate levels', async () => {
    const w = emptyWorld();
    // 1000 / 7 per g = 142.857142...  (non-terminating)
    purchased(w, 'spice', 'g', '1000', '7', 'g');
    produced(w, 'mix', 'g', '1', 'g');
    component(w, 'mix', 'spice', '1', 'g');      // mix unitCost = 1000/7 exact internally
    produced(w, 'blend', 'g', '7', 'g');         // uses 7g of mix -> 7 * (1000/7) = 1000 exactly
    component(w, 'blend', 'mix', '7', 'g');
    const node = await engine(w).computeCost('blend');
    // If intermediate were rounded to 4dp (142.8571), 7*142.8571 = 999.9997 -> would NOT be 1000.
    // With exact Decimal carried through: 7 * 1000/7 = 1000 exactly, /7 yield = 142.8571 rounded.
    expect(node.breakdown!.materialCost).toBe(1000);
    expect(node.unitCost).toBe(142.8571); // round(1000/7, 4)
  });

  it('11. preview: price change ripples to all transitive parents', async () => {
    const w = emptyWorld();
    purchased(w, 'flour', 'g', '10', '1', 'g'); // 10/g
    produced(w, 'dough', 'g', '1000', 'g');
    component(w, 'dough', 'flour', '500', 'g');  // 5000/1000 = 5/g
    produced(w, 'donut', 'pcs', '10', 'pcs');
    component(w, 'donut', 'dough', '200', 'g');  // 200*5 = 1000 -> 100/donut
    const svc = engine(w);
    const affected = await svc.previewPriceChange({
      itemId: 'flour', price: '20', purchaseQuantity: '1', purchaseUnit: 'g', // double price
    });
    const byId = Object.fromEntries(affected.map((a) => [a.itemId, a]));
    expect(byId['dough'].oldUnitCost).toBe(5);
    expect(byId['dough'].newUnitCost).toBe(10);
    expect(byId['donut'].oldUnitCost).toBe(100);
    expect(byId['donut'].newUnitCost).toBe(200);
    expect(byId['donut'].delta).toBe(100);
  });
});
