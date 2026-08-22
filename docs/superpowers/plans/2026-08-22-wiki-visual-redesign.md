# Wiki Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the wiki's browse pages (category sidebar + dense list) and detail pages (two-column layout, colored-accent tooltip-style header, sticky infobox) across all three kinds (items, skills, mods), per the approved design decision.

**Architecture:** Two new pure/testable lib modules (`accent.ts`, `categoryGroups.ts`), three new shared presentational components (`CategorySidebar`, `RarityIconBox`, `DetailInfoPanel`), then `WikiBrowse.tsx` composes the sidebar with the existing (unmodified) `WikiSearch`, and each of the three `[slug]/page.tsx` files is restructured into the two-column layout using the new shared components.

**Tech Stack:** TypeScript, React Server/Client Components (Next.js App Router), Tailwind v4 (CSS custom properties + oklch), Vitest.

## Global Constraints

- `WikiSearch.tsx`'s exported `filterEntries` function and its `{ entries, basePath }` component prop contract are **not changed** — category filtering happens by pre-filtering the `entries` array before it reaches `WikiSearch`, not by adding a new prop or touching `filterEntries`. `WikiSearch.test.ts` (which only tests `filterEntries`, not rendered output — this repo has no DOM test harness) must still pass unmodified. The component's *rendering* (the search input, the list-row markup) is not protected by this constraint and is restyled in Task 4 to match the dense-ledger look — `src/lib/wiki/normalize.ts`/`sync-wiki.ts` are untouched by this plan (no data-shape changes here at all).
- No icons in browse-list rows — `WikiSearchEntry` stays exactly as-is (no `iconUrl` field added). This is a deliberate, documented deviation from the mockup — see [2026-08-22-wiki-visual-redesign-design.md](../specs/2026-08-22-wiki-visual-redesign-design.md).
- Both light and dark CSS variable blocks in `globals.css` (`:root` and `.dark`) get the new tokens — this repo defines full palettes in both even though the app is dark-first (existing convention, see the file's own comment).
- No DOM-rendering test harness exists in this repo (no jsdom/@testing-library/react) — component-level changes are verified via `type-check`/`lint`/`build` plus a real browser click-through (the wiki is auth-gated, so the final task asks the user to confirm visually — same pattern already used for this feature area).

---

### Task 1: Accent-color tokens and helper

**Files:**
- Modify: `src/app/globals.css` (add 5 new CSS variables to both `:root` and `.dark`)
- Create: `src/lib/wiki/accent.ts`
- Test: `src/lib/wiki/accent.test.ts`

**Interfaces:**
- Produces: `export function itemAccentColor(rarity: 'normal' | 'unique'): string`, `export function skillAccentColor(color: 'r' | 'g' | 'b' | 'w'): string`, `export const MOD_ACCENT_COLOR: string` — all return CSS `var(...)` strings, consumed by Task 3's components and Tasks 5–7's detail pages.

- [ ] **Step 1: Add the new CSS variables**

In `src/app/globals.css`, inside the `.dark { ... }` block (after the existing `--sidebar-ring: oklch(0.74 0.095 85);` line, before the closing `}`), add:

```css
  /* Wiki accent colors — item rarity and skill-gem color, distinct from
     --primary so "this is a unique/gem-colored thing" reads as a different
     signal than "this is Project Vaal chrome". */
  --wiki-unique: oklch(0.68 0.13 55);
  --wiki-gem-r: oklch(0.65 0.18 25);
  --wiki-gem-g: oklch(0.68 0.15 150);
  --wiki-gem-b: oklch(0.65 0.16 250);
  --wiki-gem-w: oklch(0.90 0.01 85);
```

In the `:root { ... }` block (the light-mode fallback, after the existing `--sidebar-ring: oklch(0.62 0.10 80);` line, before the closing `}`), add the light-mode equivalents (lower lightness for legibility on a light background, matching this file's existing dark-vs-light convention — compare `--primary`'s two values):

```css
  --wiki-unique: oklch(0.58 0.13 55);
  --wiki-gem-r: oklch(0.55 0.18 25);
  --wiki-gem-g: oklch(0.55 0.15 150);
  --wiki-gem-b: oklch(0.52 0.16 250);
  --wiki-gem-w: oklch(0.35 0.01 80);
```

- [ ] **Step 2: Write the failing tests for the accent helpers**

Create `src/lib/wiki/accent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { itemAccentColor, skillAccentColor, MOD_ACCENT_COLOR } from './accent';

describe('itemAccentColor', () => {
  it('returns the unique accent for unique-rarity items', () => {
    expect(itemAccentColor('unique')).toBe('var(--wiki-unique)');
  });

  it('returns the neutral border token for normal-rarity items', () => {
    expect(itemAccentColor('normal')).toBe('var(--border)');
  });
});

describe('skillAccentColor', () => {
  it('maps each gem color letter to its own CSS variable', () => {
    expect(skillAccentColor('r')).toBe('var(--wiki-gem-r)');
    expect(skillAccentColor('g')).toBe('var(--wiki-gem-g)');
    expect(skillAccentColor('b')).toBe('var(--wiki-gem-b)');
    expect(skillAccentColor('w')).toBe('var(--wiki-gem-w)');
  });
});

describe('MOD_ACCENT_COLOR', () => {
  it('is the brand primary token', () => {
    expect(MOD_ACCENT_COLOR).toBe('var(--primary)');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/wiki/accent.test.ts`
Expected: FAIL — `./accent` module does not exist yet.

- [ ] **Step 4: Implement `src/lib/wiki/accent.ts`**

```ts
/**
 * Per-kind accent colors for the wiki's detail-page tooltip styling
 * (RarityIconBox border, DetailInfoPanel header tint). Returns CSS
 * `var(...)` references into the tokens defined in globals.css, not
 * resolved color values, so they stay theme-aware (dark/light) for free.
 */
export function itemAccentColor(rarity: 'normal' | 'unique'): string {
  return rarity === 'unique' ? 'var(--wiki-unique)' : 'var(--border)';
}

const SKILL_ACCENT: Record<'r' | 'g' | 'b' | 'w', string> = {
  r: 'var(--wiki-gem-r)',
  g: 'var(--wiki-gem-g)',
  b: 'var(--wiki-gem-b)',
  w: 'var(--wiki-gem-w)',
};

export function skillAccentColor(color: 'r' | 'g' | 'b' | 'w'): string {
  return SKILL_ACCENT[color];
}

/**
 * Mods have no per-entry color axis in the data (no rarity, no gem color)
 * — a flat brand-gold accent is the correct choice here, not a compromise.
 */
export const MOD_ACCENT_COLOR = 'var(--primary)';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/wiki/accent.test.ts && npm run type-check`
Expected: all PASS, type-check clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/lib/wiki/accent.ts src/lib/wiki/accent.test.ts
git commit -m "$(cat <<'EOF'
feat(wiki): add per-kind accent-color tokens and helper

New CSS variables (--wiki-unique, --wiki-gem-{r,g,b,w}) in both light and
dark palettes, plus itemAccentColor/skillAccentColor/MOD_ACCENT_COLOR
helpers that resolve to them. Foundation for the detail-page redesign's
rarity/gem-color accented header styling.
EOF
)"
```

---

### Task 2: Category grouping helper

**Files:**
- Create: `src/lib/wiki/categoryGroups.ts`
- Test: `src/lib/wiki/categoryGroups.test.ts`

**Interfaces:**
- Consumes: `WikiSearchEntry` type from `src/lib/wiki/types.ts` (unchanged).
- Produces: `export interface CategoryGroup { category: string; count: number }` and `export function groupByCategory(entries: WikiSearchEntry[]): CategoryGroup[]` — consumed by Task 3's `CategorySidebar` (via Task 4's `WikiBrowse`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/wiki/categoryGroups.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupByCategory } from './categoryGroups';
import type { WikiSearchEntry } from './types';

const entry = (category: string, i: number): WikiSearchEntry => ({
  slug: `${category}-${i}`, name: `${category} ${i}`, kind: 'item', category, tags: [],
});

describe('groupByCategory', () => {
  it('counts entries per category', () => {
    const entries = [entry('Currency', 1), entry('Currency', 2), entry('Boots', 1)];
    expect(groupByCategory(entries)).toEqual([
      { category: 'Currency', count: 2 },
      { category: 'Boots', count: 1 },
    ]);
  });

  it('sorts by count descending, then category name ascending on ties', () => {
    const entries = [entry('Boots', 1), entry('Amulet', 1), entry('Currency', 1), entry('Currency', 2)];
    expect(groupByCategory(entries)).toEqual([
      { category: 'Currency', count: 2 },
      { category: 'Amulet', count: 1 },
      { category: 'Boots', count: 1 },
    ]);
  });

  it('returns an empty array for no entries', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/wiki/categoryGroups.test.ts`
Expected: FAIL — `./categoryGroups` module does not exist yet.

- [ ] **Step 3: Implement `src/lib/wiki/categoryGroups.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/wiki/categoryGroups.test.ts && npm run type-check`
Expected: all PASS, type-check clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wiki/categoryGroups.ts src/lib/wiki/categoryGroups.test.ts
git commit -m "$(cat <<'EOF'
feat(wiki): add groupByCategory helper for the browse-page sidebar

Pure function, entries in, {category, count}[] out, sorted by count desc
then name asc. Feeds CategorySidebar's category list.
EOF
)"
```

---

### Task 3: Shared components — CategorySidebar, RarityIconBox, DetailInfoPanel

**Files:**
- Create: `src/components/wiki/CategorySidebar.tsx`
- Create: `src/components/wiki/RarityIconBox.tsx`
- Create: `src/components/wiki/DetailInfoPanel.tsx`

**Interfaces:**
- Consumes: `CategoryGroup` from `src/lib/wiki/categoryGroups.ts` (Task 2).
- Produces:
  - `CategorySidebar({ groups, total, selected, onSelect, kindLabel }: { groups: CategoryGroup[]; total: number; selected: string | null; onSelect: (category: string | null) => void; kindLabel: string })` — consumed by Task 4's `WikiBrowse`.
  - `RarityIconBox({ iconUrl, alt, accentColor }: { iconUrl: string | null; alt: string; accentColor: string })` — consumed by Tasks 5–7.
  - `DetailInfoPanel({ title, accentColor, rows }: { title: string; accentColor: string; rows: { label: string; value: string | number }[] })` — consumed by Tasks 5–7.

- [ ] **Step 1: Create `CategorySidebar`**

```tsx
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
```

- [ ] **Step 2: Create `RarityIconBox`**

```tsx
import Image from 'next/image';

export function RarityIconBox({
  iconUrl,
  alt,
  accentColor,
}: {
  iconUrl: string | null;
  alt: string;
  accentColor: string;
}) {
  if (!iconUrl) return null;
  return (
    <div
      className="grid size-16 shrink-0 place-items-center rounded-lg border-2 bg-card"
      style={{ borderColor: accentColor }}
    >
      <Image src={iconUrl} alt={alt} width={52} height={52} unoptimized />
    </div>
  );
}
```

- [ ] **Step 3: Create `DetailInfoPanel`**

```tsx
export function DetailInfoPanel({
  title,
  accentColor,
  rows,
}: {
  title: string;
  accentColor: string;
  rows: { label: string; value: string | number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <aside className="overflow-hidden rounded-xl border border-border bg-card md:sticky md:top-6">
      <div
        className="border-b border-border px-4 py-3"
        style={{ backgroundColor: `color-mix(in oklab, ${accentColor} 14%, transparent)` }}
      >
        <p className="text-center font-heading text-sm font-semibold">{title}</p>
      </div>
      <div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2 text-sm last:border-b-0"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="text-right font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean. (No unit tests for these three — presentational components, no DOM test harness in this repo, per Global Constraints; verified visually in Task 8.)

- [ ] **Step 5: Commit**

```bash
git add src/components/wiki/CategorySidebar.tsx src/components/wiki/RarityIconBox.tsx src/components/wiki/DetailInfoPanel.tsx
git commit -m "$(cat <<'EOF'
feat(wiki): add CategorySidebar, RarityIconBox, DetailInfoPanel components

Shared presentational pieces for the browse-page sidebar and the detail-
page tooltip-style header + sticky infobox. No page wiring yet.
EOF
)"
```

---

### Task 4: Wire the category sidebar into `WikiBrowse`, restyle the list rows

**Files:**
- Modify: `src/components/wiki/WikiBrowse.tsx`
- Modify: `src/components/wiki/WikiSearch.tsx`

**Interfaces:**
- Consumes: `groupByCategory` (Task 2), `CategorySidebar` (Task 3). `WikiSearch`'s existing `{ entries, basePath }` prop contract and its exported `filterEntries` function — both unchanged, per Global Constraints.
- Produces: nothing new for other tasks — this is where browse-page composition happens for all three kinds at once (items/skills/mods share this one component).

- [ ] **Step 1: Add category-filter state and the sidebar composition**

In `src/components/wiki/WikiBrowse.tsx`, change the `react` import to add `useMemo`:

```ts
import { useEffect, useMemo, useState } from 'react';
```

Add two more imports (next to the existing `WikiSearch` import):

```ts
import { groupByCategory } from '@/lib/wiki/categoryGroups';
import { CategorySidebar } from './CategorySidebar';
```

Immediately after the existing `const [state, setState] = useState<LoadState>({ status: 'loading' });` line, add the new state and the category grouping. Both must be unconditional hook calls — declared here, before the component's two early `if (state.status === ...)` returns, not after:

```ts
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const groups = useMemo(
    () => groupByCategory(state.status === 'ready' ? state.entries : []),
    [state]
  );
```

Then replace the component's final line, `return <WikiSearch entries={state.entries} basePath={basePath} />;` (reached only after both early returns, so `state.status === 'ready'` is narrowed here), with:

```tsx
  const visibleEntries = selectedCategory
    ? state.entries.filter((e) => e.category === selectedCategory)
    : state.entries;

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <CategorySidebar
        groups={groups}
        total={state.entries.length}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        kindLabel={entityLabel}
      />
      <div className="min-w-0 flex-1">
        <WikiSearch entries={visibleEntries} basePath={basePath} />
      </div>
    </div>
  );
```

- [ ] **Step 2: Restyle `WikiSearch`'s search input and list rows**

In `src/components/wiki/WikiSearch.tsx`, replace only the JSX in the `return (...)` of the `WikiSearch` component (the `filterEntries` function above it, and the `useMemo`/`useState` hooks, are unchanged). Current markup renders a plain `<input>` then a `divide-y` `<ul>` of two-line links; replace with:

```tsx
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted-foreground">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search the wiki"
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {results.length} of {entries.length}
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        {results.slice(0, 100).map((entry, i) => (
          <Link
            key={entry.slug}
            href={`${basePath}/${entry.slug}`}
            className={cn(
              'flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-accent/50',
              i % 2 === 1 && 'bg-card/40'
            )}
          >
            <div className="min-w-0">
              <p className="truncate font-heading text-sm text-primary">{entry.name}</p>
              <p className="truncate text-xs text-muted-foreground">{entry.category}</p>
            </div>
            {entry.tags.length > 0 && (
              <div className="hidden shrink-0 gap-1.5 sm:flex">
                {entry.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
      {results.length > 100 && (
        <p className="text-sm text-muted-foreground">
          Showing the first 100 results — refine your search to narrow them.
        </p>
      )}
    </div>
  );
}
```

Add the `cn` import at the top of the file (next to the existing `Link` import): `import { cn } from '@/lib/utils';`.

- [ ] **Step 3: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean — in particular, no `react-hooks/rules-of-hooks` violation from a conditionally-called `useMemo` in `WikiBrowse.tsx` (this exact class of bug bit that file once before during the original feature, per its own comments — double-check the hook is unconditional).

- [ ] **Step 4: Run the existing `WikiSearch` tests to confirm `filterEntries` is untouched**

Run: `npx vitest run src/components/wiki/WikiSearch.test.ts`
Expected: all pre-existing tests PASS unmodified — confirms the JSX restyle in Step 2 didn't touch `filterEntries`'s logic.

- [ ] **Step 5: Commit**

```bash
git add src/components/wiki/WikiBrowse.tsx src/components/wiki/WikiSearch.tsx
git commit -m "$(cat <<'EOF'
feat(wiki): compose CategorySidebar into WikiBrowse, restyle list rows

Category filter state lives in WikiBrowse; WikiSearch's filterEntries
function and its {entries, basePath} prop contract are untouched — it
just receives a pre-filtered entries array and renders it with the new
dense-ledger row styling (alternating shading, tag chips, bordered list).
Applies to all three browse pages (items/skills/mods) at once, since they
all render through these two shared components.
EOF
)"
```

---

### Task 5: Redesign the item detail page

**Files:**
- Modify: `src/app/wiki/items/[slug]/page.tsx`

**Interfaces:**
- Consumes: `itemAccentColor` (Task 1), `RarityIconBox`, `DetailInfoPanel` (Task 3).
- Produces: nothing new for other tasks — leaf page.

- [ ] **Step 1: Restructure the page into the two-column layout**

Replace the imports at the top of the file:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { itemAccentColor } from '@/lib/wiki/accent';
import { RarityIconBox } from '@/components/wiki/RarityIconBox';
import { DetailInfoPanel } from '@/components/wiki/DetailInfoPanel';
```

Replace everything from the `const reqs = ...` line through the component function's final closing `}` (i.e. the whole function body after `if (!item) notFound();`, including that closing brace) with:

```tsx
  const accent = itemAccentColor(item.rarity);

  const rows: { label: string; value: string | number }[] = [
    { label: 'Item Class', value: item.itemClass ?? item.category },
    { label: 'Rarity', value: item.rarity === 'unique' ? 'Unique' : 'Normal' },
  ];
  if (item.dropLevel > 0) rows.push({ label: 'Drop Level', value: item.dropLevel });
  if (item.stackSize != null && item.stackSize > 1) rows.push({ label: 'Stack Size', value: item.stackSize });
  for (const [key, value] of Object.entries(item.requirements)) {
    if (value > 0) rows.push({ label: cap(key), value });
  }
  if (item.armour) {
    for (const [key, value] of Object.entries(item.armour)) {
      if (value > 0) rows.push({ label: cap(key), value });
    }
  }
  if (item.weapon) {
    rows.push({ label: 'Damage', value: `${item.weapon.damageMin}-${item.weapon.damageMax}` });
    rows.push({ label: 'Attack Time', value: `${(item.weapon.attackTime / 1000).toFixed(2)}s` });
  }

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/wiki" className="hover:text-primary">Wiki</Link>
        <span>/</span>
        <Link href="/wiki/items" className="hover:text-primary">Items</Link>
        <span>/</span>
        <span className="text-foreground">{item.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-start">
        <article className="space-y-4">
          <header className="flex items-center gap-4">
            <RarityIconBox iconUrl={item.iconUrl} alt="" accentColor={accent} />
            <div>
              <h1
                className="font-heading text-2xl"
                style={item.rarity === 'unique' ? { color: accent } : undefined}
              >
                {item.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {item.itemClass ?? item.category}{item.rarity === 'unique' ? ' — Unique' : ''}
              </p>
            </div>
          </header>
          <Image
            src="/ornaments/divider.png"
            alt=""
            width={1096}
            height={182}
            className="h-auto w-32 opacity-60"
          />
          {item.description && (
            <p className="text-sm whitespace-pre-line">{item.description}</p>
          )}
          {item.directions && (
            <p className="text-sm italic text-muted-foreground whitespace-pre-line">{item.directions}</p>
          )}
          {item.flavourText && item.flavourText.length > 0 && (
            <p className="border-t border-border pt-3 text-sm italic text-muted-foreground">
              {item.flavourText.join(' ')}
            </p>
          )}
          {item.rarity === 'unique' && (
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              This item&apos;s actual modifier values aren&apos;t available yet — see the wiki design doc&apos;s
              known limitation on unique items.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Extracted from Path of Exile 2&apos;s game files via poe2-toolkit (MIT).
          </p>
        </article>
        <DetailInfoPanel title={item.name} accentColor={accent} rows={rows} />
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

(The `function cap(...)` helper is a new top-level function in this file, placed after the page component's closing brace — note the `return (...)` block above already includes the page component's closing `}` right before `function cap`.)

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean.

- [ ] **Step 3: Verify against real data without needing an authenticated browser session**

```bash
npx tsx -e "
import('./src/lib/wiki/load.ts').then(async ({ loadDetail }) => {
  const item = await loadDetail('item', 'blacksmiths-whetstone');
  console.log('loaded:', !!item, item?.name);
});
"
```

Expected: `loaded: true Blacksmith's Whetstone` — confirms the data path still works; full visual confirmation happens in Task 8.

- [ ] **Step 4: Commit**

```bash
git add "src/app/wiki/items/[slug]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(wiki): redesign item detail page — two-column layout, rarity accent

Left column: header (RarityIconBox + name, accent-colored for uniques),
divider, functional/flavor text. Right column: sticky DetailInfoPanel
carrying every stat fact (class, rarity, drop level, stack size,
requirements, armour/weapon) that used to be separate inline <ul> blocks.
EOF
)"
```

---

### Task 6: Redesign the skill detail page

**Files:**
- Modify: `src/app/wiki/skills/[slug]/page.tsx`

**Interfaces:**
- Consumes: `skillAccentColor` (Task 1), `RarityIconBox`, `DetailInfoPanel` (Task 3).
- Produces: nothing new for other tasks — leaf page.

- [ ] **Step 1: Restructure the page**

Replace the imports:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { skillAccentColor } from '@/lib/wiki/accent';
import { RarityIconBox } from '@/components/wiki/RarityIconBox';
import { DetailInfoPanel } from '@/components/wiki/DetailInfoPanel';
```

Replace the component body (everything from `return (` through the end of the function) with:

```tsx
  const accent = skillAccentColor(skill.color);
  const colorName: Record<'r' | 'g' | 'b' | 'w', string> = {
    r: 'Red (Strength)',
    g: 'Green (Dexterity)',
    b: 'Blue (Intelligence)',
    w: 'White (Universal)',
  };

  const rows: { label: string; value: string | number }[] = [
    { label: 'Gem Type', value: cap(skill.gemType) },
    { label: 'Color', value: colorName[skill.color] },
    { label: 'Level', value: skill.requirement.level },
  ];
  if (skill.requirement.strength > 0) rows.push({ label: 'Strength', value: skill.requirement.strength });
  if (skill.requirement.dexterity > 0) rows.push({ label: 'Dexterity', value: skill.requirement.dexterity });
  if (skill.requirement.intelligence > 0) rows.push({ label: 'Intelligence', value: skill.requirement.intelligence });

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/wiki" className="hover:text-primary">Wiki</Link>
        <span>/</span>
        <Link href="/wiki/skills" className="hover:text-primary">Skills</Link>
        <span>/</span>
        <span className="text-foreground">{skill.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-start">
        <article className="space-y-4">
          <header className="flex items-center gap-4">
            <RarityIconBox iconUrl={skill.iconUrl} alt="" accentColor={accent} />
            <div>
              <h1 className="font-heading text-2xl" style={{ color: accent }}>{skill.name}</h1>
              <p className="text-sm text-muted-foreground">{skill.category}</p>
            </div>
          </header>
          <Image
            src="/ornaments/divider.png"
            alt=""
            width={1096}
            height={182}
            className="h-auto w-32 opacity-60"
          />
          {skill.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {skill.tags.map((tag, i) => (
                <li key={`${i}-${tag}`} className="rounded border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                  {tag}
                </li>
              ))}
            </ul>
          )}
          {skill.description && <p className="text-sm whitespace-pre-line">{skill.description}</p>}
          {skill.scaling.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3 text-sm">
              {skill.scaling.map((level) => (
                <div key={level.level}>
                  <p className="text-muted-foreground">Level {level.level}</p>
                  <ul className="space-y-1">
                    {level.stats.map((stat, i) => <li key={`${i}-${stat.text}`}>{stat.text}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Extracted from Path of Exile 2&apos;s game files via poe2-toolkit (MIT).
          </p>
        </article>
        <DetailInfoPanel title={skill.name} accentColor={accent} rows={rows} />
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/wiki/skills/[slug]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(wiki): redesign skill detail page — two-column layout, gem-color accent

Accent color comes from the gem's own r/g/b/w color field (real PoE
strength/dexterity/intelligence/universal convention) — no new data,
just a field that was sitting unused in WikiSkillDetail until now.
EOF
)"
```

---

### Task 7: Redesign the mod detail page

**Files:**
- Modify: `src/app/wiki/mods/[slug]/page.tsx`

**Interfaces:**
- Consumes: `MOD_ACCENT_COLOR` (Task 1), `DetailInfoPanel` (Task 3). (No `RarityIconBox` — mods carry no icon field in `WikiModDetail`, same as before this redesign.)
- Produces: nothing new for other tasks — leaf page.

- [ ] **Step 1: Restructure the page**

Replace the imports:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { MOD_ACCENT_COLOR } from '@/lib/wiki/accent';
import { DetailInfoPanel } from '@/components/wiki/DetailInfoPanel';
```

Replace the component body (everything from `const spawnableOn = ...` through the end of the function) with:

```tsx
  const spawnableOn = mod.spawnWeights.filter((w) => w.weight > 0);

  const rows: { label: string; value: string | number }[] = [
    { label: 'Domain', value: mod.domain },
    { label: 'Generation Type', value: mod.generationType },
    { label: 'Tier', value: mod.tier ?? '—' },
    { label: 'Item Level', value: mod.level },
  ];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/wiki" className="hover:text-primary">Wiki</Link>
        <span>/</span>
        <Link href="/wiki/mods" className="hover:text-primary">Mods</Link>
        <span>/</span>
        <span className="text-foreground">{mod.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-start">
        <article className="space-y-4">
          <header>
            <h1 className="font-heading text-2xl" style={{ color: MOD_ACCENT_COLOR }}>{mod.name}</h1>
            <p className="text-sm text-muted-foreground">
              {mod.generationType} · Tier {mod.tier ?? '—'} · Item level {mod.level}
            </p>
          </header>
          {mod.stats.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-3 text-sm">
              {mod.stats.map((stat, i) => <li key={`${i}-${stat}`}>{stat}</li>)}
            </ul>
          )}
          {spawnableOn.length > 0 && (
            <div className="border-t border-border pt-3 text-sm">
              <p className="text-muted-foreground">Can roll on:</p>
              <ul className="flex flex-wrap gap-2 pt-1">
                {spawnableOn.map((w, i) => (
                  <li key={`${i}-${w.tag}`} className="rounded border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                    {w.tag}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Extracted from Path of Exile 2&apos;s game files via poe2-toolkit (MIT).
          </p>
        </article>
        <DetailInfoPanel title={mod.name} accentColor={MOD_ACCENT_COLOR} rows={rows} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/wiki/mods/[slug]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(wiki): redesign mod detail page — two-column layout, brand accent

Mods have no rarity or gem-color field, so this uses the flat brand-gold
MOD_ACCENT_COLOR — not a compromise, mods genuinely don't have a natural
per-entry color axis the way items/skills do.
EOF
)"
```

---

### Task 8: Full verification and visual confirmation

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1–7.

- [ ] **Step 1: Full test suite, type-check, lint, build**

```bash
npx vitest run && npm run type-check && npm run lint && npm run build
```

Expected: all clean.

- [ ] **Step 2: Ask the user to click through in their authenticated browser**

This repo has no DOM test harness and `/wiki` is auth-gated, so the redesign can't be screenshot-verified from here (same limitation as every other wiki UI change this session). Ask the user to reload each of the six routes — `/wiki/items`, `/wiki/skills`, `/wiki/mods`, and one detail page per kind (e.g. `/wiki/items/blacksmiths-whetstone`, a skill, a mod) — and confirm: the category sidebar filters correctly, the detail pages show the two-column layout with the colored accent border/header, and nothing looks broken on mobile widths (the sidebar should wrap into a horizontal chip row below `md`).
