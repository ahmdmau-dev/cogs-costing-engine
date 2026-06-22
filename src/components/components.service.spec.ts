import { wouldCreateCycle } from './cycle.util';

const graph: Record<string, string[]> = {
  donut: ['dough'],
  dough: ['flour'],
};
const ancestorsOf = async (id: string): Promise<string[]> => {
  const result: string[] = [];
  const visit = (target: string) => {
    for (const [parent, children] of Object.entries(graph)) {
      if (children.includes(target)) { result.push(parent); visit(parent); }
    }
  };
  visit(id);
  return result;
};

describe('cycle guard', () => {
  it('flags adding an ancestor as a component (dough -> donut would cycle)', async () => {
    expect(await wouldCreateCycle('dough', 'donut', ancestorsOf)).toBe(true);
  });
  it('allows a non-cyclic component', async () => {
    expect(await wouldCreateCycle('dough', 'sugar', ancestorsOf)).toBe(false);
  });
  it('flags self-reference', async () => {
    expect(await wouldCreateCycle('dough', 'dough', ancestorsOf)).toBe(true);
  });
});
