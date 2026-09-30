/**
 * Pure helpers for block ordering. Positions are always a dense 1..n sequence, so
 * reordering can never produce duplicates or gaps.
 */

export type LayoutEntry = { id: string; position: number; groupSize: number };

/**
 * Turns the admin's row layout into positions. Blocks missing from `rows` (e.g. added in
 * another tab) are appended in their existing order; unknown ids are ignored; each id is
 * used once. `canGroup` decides which blocks may share a row (max 3 per row).
 */
export function layoutFromRows(rows: string[][], existingOrder: string[], canGroup: (id: string) => boolean): LayoutEntry[] {
  const known = new Set(existingOrder);
  const seen = new Set<string>();
  const cleanRows: string[][] = [];
  for (const row of rows) {
    const clean: string[] = [];
    for (const id of row) {
      if (clean.length === 3 || !known.has(id) || seen.has(id)) continue;
      seen.add(id);
      clean.push(id);
    }
    if (clean.length) cleanRows.push(clean);
  }
  for (const id of existingOrder) if (!seen.has(id)) cleanRows.push([id]);

  const entries: LayoutEntry[] = [];
  for (const row of cleanRows) {
    const groupable = row.length > 1 && row.every(canGroup);
    const finalRows = groupable ? [row] : row.map((id) => [id]);
    for (const finalRow of finalRows) {
      finalRow.forEach((id, index) => {
        entries.push({ id, position: entries.length + 1, groupSize: index === 0 && finalRow.length > 1 ? finalRow.length : 1 });
      });
    }
  }
  return entries;
}

/** Moves an item one step up or down in a flat list. */
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Inserts `id` right after `afterId` (or at the end) and returns the new order. */
export function insertAfter(order: string[], id: string, afterId?: string) {
  const without = order.filter((item) => item !== id);
  const index = afterId ? without.indexOf(afterId) : -1;
  if (index === -1) return [...without, id];
  return [...without.slice(0, index + 1), id, ...without.slice(index + 1)];
}
