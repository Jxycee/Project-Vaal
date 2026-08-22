import type { WikiSearchEntry } from './types';

export interface CategoryGroup {
  category: string;
  count: number;
}

/**
 * Groups already-fetched search entries by category with a count each,
 * sorted by count descending (most entries first) then category name
 * ascending on ties — feeds the browse pages' CategorySidebar.
 */
export function groupByCategory(entries: WikiSearchEntry[]): CategoryGroup[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
