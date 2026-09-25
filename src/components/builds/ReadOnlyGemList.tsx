// Presentational, read-only rendering of a saved GemState — no state, no
// fetch, no portal. See ReadOnlyGearList.tsx's header comment for why this is
// a separate small component rather than a `readOnly` prop on GemsSheet.
import { WEAPON_SET_DOT } from '@/lib/build/weaponSetColors';
import type { GearItem } from '@/lib/build/gearSlots';
import type { GemLoadout, GemState } from '@/lib/build/gemState';

function GemIcon({ item }: { item: GearItem | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
      {item?.iconUrl ? (
        // Plain <img>, not next/image — see GearSheet.tsx's SlotRow comment
        // (this icon is under /data/wiki/, a session-cookie-protected prefix
        // next/image's server-side optimizer fetch can't carry).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] text-muted-foreground">—</span>
      )}
    </span>
  );
}

function LoadoutCard({ loadout, index, isPrimary }: { loadout: GemLoadout; index: number; isPrimary: boolean }) {
  return (
    <li className="border-b border-border/60 px-3 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Skill {index + 1}</span>
        <div className="flex items-center gap-1.5">
          {loadout.sets.length < 2 &&
            loadout.sets.map((set) => <span key={set} className={`h-2 w-2 rounded-full ${WEAPON_SET_DOT[set]}`} />)}
          {isPrimary ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
              Main skill
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <GemIcon item={loadout.skill} />
        <span className="min-w-0 truncate text-sm text-foreground">
          {loadout.skill ? loadout.skill.name : 'Empty'}
          {loadout.skill ? (
            <span className="ml-1.5 text-xs text-muted-foreground">
              Lv {loadout.level}
              {loadout.quality > 0 ? ` · ${loadout.quality}% quality` : ''}
            </span>
          ) : null}
        </span>
      </div>

      {loadout.supports.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
          {loadout.supports.map((support, i) => (
            <span
              key={`${support.slug}-${i}`}
              className="flex items-center gap-1.5 rounded-full border border-border bg-background/60 py-1 pl-1 pr-2.5 text-xs text-foreground"
            >
              <span className="h-5 w-5 shrink-0 overflow-hidden rounded">
                {support.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={support.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                ) : null}
              </span>
              {support.name}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export default function ReadOnlyGemList({ gemState }: { gemState: GemState }) {
  if (gemState.loadouts.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No gems recorded.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
      {gemState.loadouts.map((loadout, i) => (
        <LoadoutCard key={loadout.id} loadout={loadout} index={i} isPrimary={loadout.id === gemState.primaryId} />
      ))}
    </ul>
  );
}
