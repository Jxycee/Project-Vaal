'use client';

// TEST-GRADE (Slice 5, plans/2026-09-25-slice5-defence-engine.md): plain
// markup, 44px controls, functional only — the UI pass replaces it.
//
// The live checkpoint's defences per weapon set, the campaign act they
// assume, Spirit against the Spirit its gems reserve, and — never hidden —
// everything the numbers do not count and everything they assume.
//
// Portaled to document.body at z-40 for the stacking-context reason
// GearSheet.tsx's header gives.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { Resistance } from '@/lib/build/stats/engine';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { SetResult } from '@/components/build/useDefenceSheets';

function resistanceText(r: Resistance): string {
  return r.uncapped === r.value ? `${r.value}% (max ${r.max}%)` : `${r.value}% (max ${r.max}%, ${r.uncapped}% before the cap)`;
}

export default function StatsSheet({
  open,
  sheets,
  reserved,
  onClose,
}: {
  open: boolean;
  sheets: { 1: SetResult; 2: SetResult } | { error: string } | null;
  reserved: ReservedSpiritResult | null;
  onClose: () => void;
}) {
  const [set, setSet] = useState<WeaponSet>(1);
  if (!open || typeof document === 'undefined') return null;

  const body = (() => {
    if (sheets === null) return <p className="p-3 text-sm text-muted-foreground">Calculating…</p>;
    if ('error' in sheets) return <p className="p-3 text-sm text-destructive" role="alert">Could not load stat data: {sheets.error}</p>;
    const { sheet, collected } = sheets[set];
    const reservedHere = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
    const rows: [string, string, string][] = [
      ['Life', String(sheet.life), 'stat-life'],
      ['Mana', String(sheet.mana), 'stat-mana'],
      ['Energy Shield', String(sheet.energyShield), 'stat-energy-shield'],
      ['Armour', String(sheet.armour), 'stat-armour'],
      ['Evasion', String(sheet.evasion), 'stat-evasion'],
      ['Strength', String(sheet.str), 'stat-str'],
      ['Dexterity', String(sheet.dex), 'stat-dex'],
      ['Intelligence', String(sheet.int), 'stat-int'],
      ['Fire Resistance', resistanceText(sheet.fire), 'stat-fire'],
      ['Cold Resistance', resistanceText(sheet.cold), 'stat-cold'],
      ['Lightning Resistance', resistanceText(sheet.lightning), 'stat-lightning'],
      ['Chaos Resistance', resistanceText(sheet.chaos), 'stat-chaos'],
      ['Spirit', reservedHere === null ? String(sheet.spirit) : `${sheet.spirit} (${reservedHere} reserved)`, 'stat-spirit'],
    ];
    return (
      <>
        <p className="px-3 pt-3 text-xs text-muted-foreground" data-testid="stat-act">
          Assumed campaign progress: {collected.act} (from the checkpoint&apos;s level)
        </p>
        {reservedHere !== null && reservedHere > sheet.spirit ? (
          <p className="px-3 pt-2 text-sm text-destructive" data-testid="stat-spirit-over" role="alert">
            ⚠ Gems reserve {reservedHere} Spirit, but this set has {sheet.spirit}.
          </p>
        ) : null}
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-3 text-sm">
          {rows.map(([label, value, id]) => (
            <div key={id} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd data-testid={id} className="text-right text-foreground tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {collected.notCounted.length > 0 ? (
          <section className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <h3 className="mb-1 text-foreground">Not counted</h3>
            <ul data-testid="stat-not-counted">
              {collected.notCounted.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {collected.assumed.length > 0 ? (
          <section className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <h3 className="mb-1 text-foreground">Assumed</h3>
            <ul data-testid="stat-assumed">
              {collected.assumed.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </>
    );
  })();

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="stats-sheet">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Stats</span>
        <button type="button" onClick={onClose} aria-label="Close stats sheet" className="flex h-11 w-11 items-center justify-center text-muted-foreground">
          <X size={18} />
        </button>
      </div>
      <div className="flex gap-1.5 border-b border-border px-3 py-3">
        {([1, 2] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === set}
            onClick={() => setSet(s)}
            className={`flex h-11 items-center rounded-full px-3 text-xs font-medium ${s === set ? 'bg-primary text-primary-foreground' : 'bg-background/60 text-muted-foreground'}`}
          >
            Set {s === 1 ? 'I' : 'II'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">{body}</div>
    </div>,
    document.body,
  );
}
