'use client';

import { useState } from 'react';
import ReadOnlyGearList from '@/components/builds/ReadOnlyGearList';
import GearSheet from '@/components/build/GearSheet';
import JewelsSheet from '@/components/build/JewelsSheet';
import { useBuildSession } from '../session/BuildSession';

const EDIT_BUTTON = 'flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground disabled:opacity-50';

export default function GearTab({ edit }: { edit: boolean }) {
  const { gear, warnings, offHandOccupied, setGearSlot, jewels, pickJewel, clearJewel } = useBuildSession();
  const [gearSheetOpen, setGearSheetOpen] = useState(false);
  const [jewelsSheetOpen, setJewelsSheetOpen] = useState(false);
  const jewelList = Object.values(gear.jewels);
  return (
    <div id="gear-tab" role="tabpanel" data-testid="gear-tab" className="flex flex-col gap-4">
      {edit ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setGearSheetOpen(true)} className={EDIT_BUTTON}>
            Edit gear
          </button>
          <button type="button" onClick={() => setJewelsSheetOpen(true)} disabled={!jewels} className={EDIT_BUTTON}>
            {jewels ? 'Edit jewels' : 'Loading tree…'}
          </button>
        </div>
      ) : null}
      <ReadOnlyGearList gear={gear} />
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Jewels</h2>
        {jewelList.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No jewels recorded.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
            {jewelList.map((item, i) => (
              <li key={`${item.slug}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
                  {item.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </span>
                <span className="min-w-0 truncate text-sm text-foreground">
                  {item.name}
                  {item.isUnique ? (
                    <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                      Unique
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {edit ? (
        <>
          <GearSheet
            open={gearSheetOpen}
            gear={gear}
            warnings={warnings}
            occupiedBy={offHandOccupied}
            onChange={setGearSlot}
            onClose={() => setGearSheetOpen(false)}
          />
          <JewelsSheet
            open={jewelsSheetOpen}
            sockets={jewels?.sockets ?? []}
            orphans={jewels?.orphans ?? []}
            onPick={pickJewel}
            onClear={clearJewel}
            onClose={() => setJewelsSheetOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
