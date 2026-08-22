'use client';

import { cn } from '@/lib/utils';
import type { CategoryGroup } from '@/lib/wiki/categoryGroups';

export function CategorySidebar({
  groups,
  total,
  selected,
  onSelect,
  kindLabel,
}: {
  groups: CategoryGroup[];
  total: number;
  selected: string | null;
  onSelect: (category: string | null) => void;
  kindLabel: string;
}) {
  const pillClass = (active: boolean) =>
    cn(
      'flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
      active
        ? 'bg-primary/16 font-medium text-primary'
        : 'text-foreground hover:bg-accent/50'
    );

  return (
    <nav
      aria-label={`${kindLabel} categories`}
      className="flex flex-row flex-wrap gap-1.5 md:w-56 md:shrink-0 md:flex-col md:gap-1"
    >
      <button type="button" className={pillClass(selected === null)} onClick={() => onSelect(null)}>
        <span>All {kindLabel}</span>
        <span className="text-xs text-muted-foreground">{total}</span>
      </button>
      {groups.map((g) => (
        <button
          key={g.category}
          type="button"
          className={pillClass(selected === g.category)}
          onClick={() => onSelect(g.category)}
        >
          <span className="truncate">{g.category}</span>
          <span className="text-xs text-muted-foreground">{g.count}</span>
        </button>
      ))}
    </nav>
  );
}
