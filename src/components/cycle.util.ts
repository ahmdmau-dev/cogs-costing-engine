// Returns true if making `componentId` a component of `parentId` would create a cycle:
// i.e. componentId === parentId, or componentId is already an ancestor of parentId.
export async function wouldCreateCycle(
  parentId: string,
  componentId: string,
  ancestorsOf: (id: string) => Promise<string[]>,
): Promise<boolean> {
  if (parentId === componentId) return true;
  const ancestors = await ancestorsOf(parentId);
  return ancestors.includes(componentId);
}
