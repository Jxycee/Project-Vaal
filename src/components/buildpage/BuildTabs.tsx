'use client';

// The tab strip. Tabs are client-only: pushState updates ?tab= without a
// server request (Next syncs it into useSearchParams), so Back returns to the
// previous tab and a tap never re-runs the server page — which would re-count
// a view on public builds. Never swap this for <Link> or router.push.
import { BUILD_TABS, BUILD_TAB_LABELS, type BuildTab } from '@/lib/build/buildPage';
import { selectTab } from './tabNav';

export default function BuildTabs({ active }: { active: BuildTab }) {
  function select(tab: BuildTab) {
    if (tab === active) return;
    selectTab(tab);
  }
  return (
    <div role="tablist" aria-label="Build sections" className="grid grid-cols-5 border-b border-border">
      {BUILD_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={tab === active}
          aria-controls={`${tab}-tab`}
          onClick={() => select(tab)}
          className={`flex h-11 min-w-11 items-center justify-center border-b-2 text-sm font-medium ${
            tab === active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
          }`}
        >
          {BUILD_TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
