export function fittingTabs<T extends string>(
  tabs: readonly T[],
  required: readonly T[],
  widths: ReadonlyMap<T, number>,
  available: number,
  overflowWidth: number,
  alwaysOverflow = false,
): T[] {
  const width = (tab: T) => widths.get(tab) || 0;
  if (!alwaysOverflow && tabs.reduce((total, tab) => total + width(tab), 0) <= available) return [...tabs];
  const visible = new Set(tabs.filter(tab => required.includes(tab)));
  let remaining = available - overflowWidth - [...visible].reduce((total, tab) => total + width(tab), 0);
  for (const tab of tabs) {
    if (visible.has(tab)) continue;
    const size = width(tab);
    if (size > remaining) break;
    visible.add(tab);
    remaining -= size;
  }
  return tabs.filter(tab => visible.has(tab));
}
