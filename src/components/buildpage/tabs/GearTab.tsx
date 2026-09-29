'use client';

import { useEffect, useRef, useState } from 'react';
import JewelsSheet from '@/components/build/JewelsSheet';
import { headlineSet } from '@/lib/build/buildPage';
import { dollSlot, type DollSlotKey } from '@/lib/build/paperDoll';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import GearSlotDetail from '../gear/GearSlotDetail';
import PaperDoll from '../gear/PaperDoll';
import { useBuildSession } from '../session/BuildSession';

const EDIT_BUTTON = 'flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground disabled:opacity-50';

export default function GearTab({ edit }: { edit: boolean }) {
  const { gear, gems, warnings, offHandOccupied, setGearSlot, jewels, pickJewel, clearJewel } = useBuildSession();
  const [weaponSet, setWeaponSet] = useState<WeaponSet>(() => headlineSet(gems));
  const [selected, setSelected] = useState<DollSlotKey | null>(null);
  // Bumped on every cell tap, so re-tapping the selected cell also scrolls.
  const [tapCount, setTapCount] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [jewelsSheetOpen, setJewelsSheetOpen] = useState(false);
  const jewelList = Object.values(gear.jewels);

  const selectedSlot = selected ? dollSlot(selected, weaponSet) : null;
  const slotWarnings = selectedSlot
    ? warnings.filter((w) => w.target.kind === 'gear' && w.target.slot === selectedSlot)
    : [];
  // The detail panel sits below the doll, so on a phone a tap on a low cell
  // opens it off-screen — and it holds the owner's Choose / Edit / Clear.
  // Bring it into view once it has rendered (`nearest`: no movement if it
  // already is; its scroll-mb clears the fixed bottom nav).
  useEffect(() => {
    if (tapCount === 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    detailRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [tapCount, selected]);

  const hasWarning = warnings.some((w) => w.severity === 'warning');

  return (
    <div id="gear-tab" role="tabpanel" data-testid="gear-tab" className="flex flex-col gap-4">
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            data-testid="gear-warnings"
            aria-expanded={warningsOpen}
            onClick={() => setWarningsOpen((open) => !open)}
            className="flex h-11 w-fit items-center gap-1.5 rounded-full border border-border px-4 text-sm text-foreground"
          >
            <span className={hasWarning ? 'text-destructive' : 'text-muted-foreground'}>{hasWarning ? '⚠' : 'ⓘ'}</span>
            {warnings.length} {hasWarning ? (warnings.length === 1 ? 'warning' : 'warnings') : warnings.length === 1 ? 'note' : 'notes'}
          </button>
          {warningsOpen ? (
            <ul className="rounded-lg border border-border bg-card/40 px-3 py-2 text-xs">
              {warnings.map((w, i) => (
                <li key={`${w.code}-${i}`} data-testid="build-warning" data-severity={w.severity} className="py-1 text-foreground">
                  {w.severity === 'warning' ? '⚠ ' : 'ⓘ '}
                  {w.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <PaperDoll
        gear={gear}
        weaponSet={weaponSet}
        onWeaponSet={setWeaponSet}
        selected={selected}
        onSelect={(key) => {
          setSelected(key);
          setTapCount((n) => n + 1);
        }}
        warnings={warnings}
        offHandOccupied={offHandOccupied}
      />

      {selectedSlot ? (
        <div ref={detailRef} className="scroll-mb-24">
          <GearSlotDetail
            // Keyed by slot: a different cell (or the other weapon set) starts
            // with its picker and editor closed.
            key={selectedSlot}
            slot={selectedSlot}
            item={gear[selectedSlot]}
            occupiedBy={selectedSlot.endsWith('_off') ? offHandOccupied[weaponSet] : null}
            warnings={slotWarnings}
            edit={edit}
            onChange={setGearSlot}
          />
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Tap a slot to see its item.</p>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Jewels</h2>
          {edit ? (
            <button type="button" onClick={() => setJewelsSheetOpen(true)} disabled={!jewels} className={EDIT_BUTTON}>
              {jewels ? 'Edit jewels' : 'Loading tree…'}
            </button>
          ) : null}
        </div>
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
        <JewelsSheet
          open={jewelsSheetOpen}
          sockets={jewels?.sockets ?? []}
          orphans={jewels?.orphans ?? []}
          onPick={pickJewel}
          onClear={clearJewel}
          onClose={() => setJewelsSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
