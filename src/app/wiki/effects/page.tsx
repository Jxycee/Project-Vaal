import { Suspense } from 'react';
import { WikiBrowse } from '@/components/wiki/WikiBrowse';
import type { QuickFilter } from '@/components/wiki/WikiBrowse';

// Derived from GGPK's own `BuffDefinitions.BuffCategory` (see
// BUFF_CATEGORY_TAG in src/lib/wiki/normalize.ts) plus a name-shape check
// for Aura — see docs/superpowers/specs/2026-08-24-wiki-ggpk-source-audit.md
// for how these were reverse-engineered and why the smallest/least legible
// raw categories are left untagged rather than guessed. Colors reuse the
// existing gem/attribute palette (globals.css) instead of inventing new
// tokens - Buff/Debuff mirror the red/green Str/Dex convention loosely,
// Charm/Curse/Shrine borrow the hybrid-attribute tokens, Immunity reuses
// the "universal" white/gold gem token.
const EFFECT_QUICK_FILTERS: QuickFilter[] = [
  { tag: 'Buff', label: 'Buff', color: 'var(--wiki-gem-g)' },
  { tag: 'Debuff', label: 'Debuff', color: 'var(--wiki-gem-r)' },
  { tag: 'Ailment', label: 'Ailment', color: 'var(--wiki-gem-r)' },
  { tag: 'Curse', label: 'Curse', color: 'var(--wiki-attr-str-int)' },
  { tag: 'Charm', label: 'Charm', color: 'var(--wiki-attr-str-dex)' },
  { tag: 'Charge', label: 'Charge', color: 'var(--primary)' },
  { tag: 'Aura', label: 'Aura', color: 'var(--wiki-gem-b)' },
  { tag: 'Shrine', label: 'Shrine', color: 'var(--wiki-attr-dex-int)' },
  { tag: 'Immunity', label: 'Immunity', color: 'var(--wiki-gem-w)' },
];

export default function EffectsPage() {
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Effects</h1>
      <Suspense>
        <WikiBrowse kind="effect" basePath="/wiki/effects" quickFilters={EFFECT_QUICK_FILTERS} />
      </Suspense>
    </>
  );
}
