import { UnitConverter } from '../../src/units/unit-converter';
import { ConversionEdge, ConversionGateway } from '../../src/units/conversion.gateway';

function gateway(edges: ConversionEdge[]): ConversionGateway {
  return {
    getEdges: async (itemId) =>
      edges.filter((e) => e.itemId === null || e.itemId === itemId),
  };
}
const g = (fromUnit: string, toUnit: string, factor: string): ConversionEdge => ({
  itemId: null, fromUnit, toUnit, factor,
});

describe('UnitConverter', () => {
  it('returns 1 when units are equal', async () => {
    const c = new UnitConverter(gateway([]));
    expect((await c.factor('g', 'g', null)).toString()).toBe('1');
  });

  it('resolves a direct global edge', async () => {
    const c = new UnitConverter(gateway([g('kg', 'g', '1000')]));
    expect((await c.factor('kg', 'g', null)).toString()).toBe('1000');
  });

  it('resolves the implicit inverse', async () => {
    const c = new UnitConverter(gateway([g('kg', 'g', '1000')]));
    expect((await c.factor('g', 'kg', null)).toString()).toBe('0.001');
  });

  it('resolves a multi-hop path', async () => {
    const c = new UnitConverter(gateway([g('L', 'ml', '1000'), g('ml', 'tsp', '0.2')]));
    expect((await c.factor('L', 'tsp', null)).toString()).toBe('200');
  });

  it('prefers a per-item edge over a global one', async () => {
    const c = new UnitConverter(
      gateway([
        g('ekor', 'g', '500'),
        { itemId: 'chicken', fromUnit: 'ekor', toUnit: 'g', factor: '1000' },
      ]),
    );
    expect((await c.factor('ekor', 'g', 'chicken')).toString()).toBe('1000');
  });

  it('throws when no path exists', async () => {
    const c = new UnitConverter(gateway([g('kg', 'g', '1000')]));
    await expect(c.factor('g', 'ml', null)).rejects.toThrow(/No conversion path/);
  });
});
