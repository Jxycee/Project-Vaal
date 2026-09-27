'use client';

// Desktop-only right rail (md:+): the headline set's defences, visible on
// every tab except Tree.
import type { ReactNode } from 'react';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from './HeaderStats';

export default function StatsRail({ sheets, set, reserved }: { sheets: Sheets; set: WeaponSet; reserved: ReservedSpiritResult | null }) {
  let body: ReactNode;
  if (sheets === null) body = <p className="text-muted-foreground">Calculating…</p>;
  else if ('error' in sheets) body = <p className="text-muted-foreground">Stats unavailable</p>;
  else {
    const s = sheets[set].sheet;
    const r = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
    const rows: [string, string][] = [
      ['Life', String(s.life)],
      ['Energy Shield', String(s.energyShield)],
      ['Mana', String(s.mana)],
      ['Armour', String(s.armour)],
      ['Evasion', String(s.evasion)],
      ['Fire', `${s.fire.value}%`],
      ['Cold', `${s.cold.value}%`],
      ['Lightning', `${s.lightning.value}%`],
      ['Chaos', `${s.chaos.value}%`],
      ['Spirit', r === null ? String(s.spirit) : `${r} / ${s.spirit}`],
    ];
    body = (
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <aside data-testid="stats-rail" className="hidden self-start rounded-lg border border-border bg-card/40 p-3 text-sm md:sticky md:top-4 md:block">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stats · Set {set === 1 ? 'I' : 'II'}</h2>
      {body}
    </aside>
  );
}
