'use client';

import { Fragment, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CategoryGroup } from '@/lib/wiki/categoryGroups';
import type { CategorySection } from '@/lib/wiki/categoryTaxonomy';

const NAV_CLASS =
  'flex max-h-32 flex-row flex-wrap gap-1.5 overflow-y-auto md:w-56 md:max-h-[calc(100vh-6rem)] md:shrink-0 md:flex-col md:flex-nowrap md:gap-1 md:sticky md:top-6 md:overflow-y-auto';

function pillClass(active: boolean) {
  return cn(
    'flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
    active ? 'bg-primary/16 font-medium text-primary' : 'text-foreground hover:bg-accent/50'
  );
}

export function CategorySidebar({
  groups,
  sections,
  total,
  selected,
  onSelect,
  kindLabel,
}: {
  groups: CategoryGroup[];
  /** Null for kinds with too few categories to bother grouping (skills, mods). */
  sections: CategorySection[] | null;
  total: number;
  selected: string | null;
  onSelect: (category: string | null) => void;
  kindLabel: string;
}) {
  const initiallyExpanded = new Set<string>();
  if (sections && selected) {
    const owner = sections.find((s) => s.categories.some((c) => c.category === selected));
    if (owner) initiallyExpanded.add(owner.label);
  }
  const [expanded, setExpanded] = useState<Set<string>>(initiallyExpanded);

  function toggle(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const allButton = (
    <button
      type="button"
      className={pillClass(selected === null)}
      aria-pressed={selected === null}
      onClick={() => onSelect(null)}
    >
      <span>All {kindLabel}</span>
      <span className="text-xs text-muted-foreground">{total}</span>
    </button>
  );

  if (!sections) {
    return (
      <nav aria-label={`${kindLabel} categories`} className={NAV_CLASS}>
        {allButton}
        {groups.map((g) => (
          <button
            key={g.category}
            type="button"
            className={pillClass(selected === g.category)}
            aria-pressed={selected === g.category}
            onClick={() => onSelect(g.category)}
          >
            <span className="truncate">{g.category}</span>
            <span className="text-xs text-muted-foreground">{g.count}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label={`${kindLabel} categories`} className={NAV_CLASS}>
      {allButton}
      {sections.map((section) => {
        const isOpen = expanded.has(section.label);
        return (
          <Fragment key={section.label}>
            <button
              type="button"
              className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={isOpen}
              onClick={() => toggle(section.label)}
            >
              <span className="flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={cn('shrink-0 transition-transform', isOpen && 'rotate-90')}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {section.label}
              </span>
              <span className="text-xs">{section.total}</span>
            </button>
            {isOpen &&
              section.categories.map((g) => (
                <button
                  key={g.category}
                  type="button"
                  className={cn(pillClass(selected === g.category), 'pl-7')}
                  aria-pressed={selected === g.category}
                  onClick={() => onSelect(g.category)}
                >
                  <span className="truncate">{g.category}</span>
                  <span className="text-xs text-muted-foreground">{g.count}</span>
                </button>
              ))}
          </Fragment>
        );
      })}
    </nav>
  );
}
