import { Suspense } from 'react';
import { WikiBrowse } from '@/components/wiki/WikiBrowse';
import type { QuickFilter } from '@/components/wiki/WikiBrowse';

// "Unique" is unshifted onto a unique item's tags in normalize.ts's
// toSearchEntry, same mechanism the effects quick filters (Buff/Debuff/...)
// already use — see EffectsPage. Same unique-rarity accent
// itemAccentColor('unique') uses on the detail page.
const ITEM_QUICK_FILTERS: QuickFilter[] = [
  { tag: 'Unique', label: 'Unique', color: 'var(--wiki-unique)' },
];

export default function ItemsPage() {
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Items</h1>
      <Suspense>
        <WikiBrowse kind="item" quickFilters={ITEM_QUICK_FILTERS} />
      </Suspense>
    </>
  );
}
